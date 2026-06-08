// lib/__tests__/process_calendar_delta.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import { processCalendarDelta } from "../process-calendar-delta";
import type { CalendarEvent } from "../google-calendar";

vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  updateEvent: vi.fn().mockResolvedValue({ etag: '"new-etag"' }),
  addDays: (d: string, n: number) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  },
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedWithEvent(db: Database.Database, overrides: Record<string, unknown> = {}) {
  db.prepare(
    "INSERT INTO people (id, first_name, last_name, active, email) VALUES (1, 'Alice', '', 1, null), (2, 'Owner', 'Bob', 1, 'bob@example.com') ON CONFLICT DO NOTHING"
  ).run();
  db.prepare(
    "INSERT INTO cars (id, short, name, price_per_km, owner_person_id, active) VALUES (1, 'CA', 'Car A', 0.2, 2, 1) ON CONFLICT DO NOTHING"
  ).run();
  const defaults = {
    google_event_id: "evt-123",
    last_synced_etag: '"old-etag"',
    last_app_write_nonce: "nonce-abc",
    last_known_response_status: "needsAction",
    status: "pending",
  };
  const merged = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO reservations (person_id, car_id, start_date, end_date, status, updated_at,
      google_event_id, last_synced_etag, last_app_write_nonce, last_known_response_status)
     VALUES (1, 1, '2026-06-01', '2026-06-03', ?, datetime('now'), ?, ?, ?, ?)`
  ).run(
    merged.status,
    merged.google_event_id,
    merged.last_synced_etag,
    merged.last_app_write_nonce,
    merged.last_known_response_status
  );
}

const fakeClient = {} as any;
const calendarId = "cal-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processCalendarDelta", () => {
  it("skips events not found in reservations", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [{ id: "unknown-evt", etag: '"new"' }];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("skips event if etag matches last_synced_etag (echo)", async () => {
    const db = makeDb();
    seedWithEvent(db, { last_synced_etag: '"same-etag"' });
    const events: CalendarEvent[] = [{ id: "evt-123", etag: '"same-etag"' }];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("skips event if appWriteNonce matches last_app_write_nonce when etag absent (echo fallback)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: null, // no etag — nonce is the only echo guard
        extendedProperties: { private: { appWriteNonce: "nonce-abc" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("overwrites calendar when time is edited (app is authoritative)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-07-01" }, // wrong date
        end: { date: "2026-07-04" },
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).toHaveBeenCalledOnce();
    const row = db
      .prepare(
        "SELECT last_synced_etag, last_app_write_nonce FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as { last_synced_etag: string; last_app_write_nonce: string };
    expect(row.last_synced_etag).toBe('"new-etag"');
    expect(row.last_app_write_nonce).toBeTruthy();
  });

  it("does NOT time-overwrite a timed reservation (times are push-only, #191)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    db.prepare(
      "UPDATE reservations SET start_time='09:00', end_time='12:30' WHERE google_event_id='evt-123'"
    ).run();
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        // GCal reports a (timed) date that won't match the all-day comparison;
        // for a timed reservation we must NOT push an overwrite.
        start: { date: "2026-07-01" },
        end: { date: "2026-07-04" },
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("updates reservation to confirmed when owner accepts", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" }, // end_date + 1 (exclusive)
        attendees: [{ email: "bob@example.com", responseStatus: "accepted" }],
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    const row = db
      .prepare(
        "SELECT status, last_known_response_status FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as { status: string; last_known_response_status: string };
    expect(row.status).toBe("confirmed");
    expect(row.last_known_response_status).toBe("accepted");
  });

  it("rejects and cancels the live event when owner declines (#350 converge)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        attendees: [{ email: "bob@example.com", responseStatus: "declined" }],
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);

    // Converge: event still live → push a cancel so it doesn't linger as a ghost.
    expect(calMock.updateEvent).toHaveBeenCalledOnce();
    const args = (calMock.updateEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((args[3] as { status: string }).status).toBe("rejected"); // -> cancelled event
    const row = db
      .prepare(
        "SELECT status, last_known_response_status, last_synced_etag, last_app_write_nonce FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as {
      status: string;
      last_known_response_status: string;
      last_synced_etag: string;
      last_app_write_nonce: string;
    };
    expect(row.status).toBe("rejected");
    expect(row.last_known_response_status).toBe("declined");
    // nonce/etag from our own cancel push → resulting webhook is echo-skipped
    expect(row.last_synced_etag).toBe('"new-etag"');
    expect(row.last_app_write_nonce).not.toBe("nonce-abc");
  });

  it("pushes a confirmed event and uninvites the owner when the owner accepts (#337)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        attendees: [{ email: "bob@example.com", responseStatus: "accepted" }],
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);

    // Pushed an outbound confirm: updateEvent(client, calId, eventId, reservation, nonce, ownerEmail)
    expect(calMock.updateEvent).toHaveBeenCalledOnce();
    const args = (calMock.updateEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(args[2]).toBe("evt-123");
    expect((args[3] as { status: string }).status).toBe("confirmed");
    expect(args[5]).toBe("bob@example.com");

    const row = db
      .prepare(
        "SELECT status, last_known_response_status, last_synced_etag, last_app_write_nonce FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as {
      status: string;
      last_known_response_status: string;
      last_synced_etag: string;
      last_app_write_nonce: string;
    };
    expect(row.status).toBe("confirmed");
    expect(row.last_known_response_status).toBe("accepted");
    // etag/nonce come from our own push, so the resulting webhook is echo-skipped.
    expect(row.last_synced_etag).toBe('"new-etag"');
    expect(row.last_app_write_nonce).toBeTruthy();
    expect(row.last_app_write_nonce).not.toBe("nonce-abc");
  });

  it("does not churn an already-confirmed reservation once the owner is uninvited (#337)", async () => {
    const db = makeDb();
    // Confirmed + owner already removed as attendee; last known RSVP was accepted.
    seedWithEvent(db, { status: "confirmed", last_known_response_status: "accepted" });
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        attendees: [], // owner no longer an attendee -> would read as needsAction
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);

    expect(calMock.updateEvent).not.toHaveBeenCalled();
    const row = db
      .prepare(
        "SELECT status, last_known_response_status FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as { status: string; last_known_response_status: string };
    expect(row.status).toBe("confirmed");
    expect(row.last_known_response_status).toBe("accepted");
  });

  it("treats an already-cancelled event as declined without re-pushing (#350)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        status: "cancelled",
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    // Event already gone (owner deleted the shared event, #8) → nothing to push.
    expect(calMock.updateEvent).not.toHaveBeenCalled();
    const row = db
      .prepare("SELECT status FROM reservations WHERE google_event_id = 'evt-123'")
      .get() as { status: string };
    expect(row.status).toBe("rejected");
  });
});
