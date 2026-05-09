// lib/__tests__/reservation_sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import {
  syncReservationCreate,
  syncReservationUpdate,
  syncReservationDelete,
} from "../reservation-sync";

// Mock the google-calendar module
vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  createEvent: vi.fn().mockResolvedValue({ id: "evt-123", etag: '"etag-abc"' }),
  updateEvent: vi.fn().mockResolvedValue({ etag: '"etag-xyz"' }),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedReservation(db: Database.Database): number {
  db.prepare("INSERT INTO people (id, name, active) VALUES (1, 'Alice', 1)").run();
  db.prepare(
    "INSERT INTO people (id, name, active, email) VALUES (2, 'Owner Bob', 1, 'bob@example.com')"
  ).run();
  db.prepare(
    "INSERT INTO cars (id, short, name, price_per_km, owner_person_id, active) VALUES (1, 'CA', 'Car A', 0.2, 2, 1)"
  ).run();
  const result = db
    .prepare(
      "INSERT INTO reservations (person_id, car_id, start_date, end_date, status, updated_at) VALUES (1, 1, '2026-06-01', '2026-06-03', 'pending', datetime('now'))"
    )
    .run();
  return result.lastInsertRowid as number;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncReservationCreate", () => {
  it("does nothing when calendar settings are empty", async () => {
    const db = makeDb();
    seedReservation(db);
    await syncReservationCreate(db, 1);
    expect(calMock.createEvent).not.toHaveBeenCalled();
  });

  it("calls createEvent and saves event_id + etag", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationCreate(db, id);

    expect(calMock.createEvent).toHaveBeenCalledOnce();
    const row = db
      .prepare(
        "SELECT google_event_id, last_synced_etag, last_app_write_nonce FROM reservations WHERE id = ?"
      )
      .get(id) as {
      google_event_id: string;
      last_synced_etag: string;
      last_app_write_nonce: string;
    };
    expect(row.google_event_id).toBe("evt-123");
    expect(row.last_synced_etag).toBe('"etag-abc"');
    expect(row.last_app_write_nonce).toBeTruthy();
  });

  it("passes owner email to createEvent when owner has email", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationCreate(db, id);

    const callArgs = vi.mocked(calMock.createEvent).mock.calls[0];
    expect(callArgs[4]).toBe("bob@example.com");
  });
});

describe("syncReservationUpdate", () => {
  it("does nothing if reservation has no google_event_id", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationUpdate(db, id);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("calls updateEvent and updates etag", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");
    db.prepare("UPDATE reservations SET google_event_id='evt-123' WHERE id=?").run(id);

    await syncReservationUpdate(db, id);

    expect(calMock.updateEvent).toHaveBeenCalledOnce();
    const row = db
      .prepare("SELECT last_synced_etag, last_app_write_nonce FROM reservations WHERE id = ?")
      .get(id) as { last_synced_etag: string; last_app_write_nonce: string };
    expect(row.last_synced_etag).toBe('"etag-xyz"');
    expect(row.last_app_write_nonce).toBeTruthy();
  });
});

describe("syncReservationDelete", () => {
  it("calls deleteEvent and clears calendar columns", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");
    db.prepare(
      "UPDATE reservations SET google_event_id='evt-123', last_synced_etag='e', last_app_write_nonce='n', last_known_response_status='needsAction' WHERE id=?"
    ).run(id);

    await syncReservationDelete(db, id);

    expect(calMock.deleteEvent).toHaveBeenCalledWith(expect.anything(), "cal-id", "evt-123");
    const row = db
      .prepare(
        "SELECT google_event_id, last_synced_etag, last_app_write_nonce, last_known_response_status FROM reservations WHERE id = ?"
      )
      .get(id) as {
      google_event_id: string | null;
      last_synced_etag: string | null;
      last_app_write_nonce: string | null;
      last_known_response_status: string | null;
    };
    expect(row.google_event_id).toBeNull();
    expect(row.last_synced_etag).toBeNull();
    expect(row.last_app_write_nonce).toBeNull();
    expect(row.last_known_response_status).toBeNull();
  });
});
