// lib/__tests__/calendar_renew.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import { handleCalendarRenew } from "../calendar-renew";

vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  stopChannel: vi.fn().mockResolvedValue(undefined),
  watchEvents: vi.fn().mockResolvedValue({
    channelId: "new-ch",
    resourceId: "new-res",
    expiration: "2026-05-16T04:00:00.000Z",
  }),
  listEventsDelta: vi.fn().mockResolvedValue({ items: [], nextSyncToken: "new-tok" }),
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleCalendarRenew", () => {
  it("returns skipped:disabled when settings are empty", async () => {
    const db = makeDb();
    const result = await handleCalendarRenew(db, "https://example.com");
    expect(result).toEqual({ ok: true, skipped: "disabled" });
    expect(calMock.watchEvents).not.toHaveBeenCalled();
  });

  it("returns skipped:not_due when channel expires in >5 days", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");
    const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (1, 'ch', 'res', ?, 'tok')"
    ).run(future);

    const result = await handleCalendarRenew(db, "https://example.com");
    expect(result).toEqual({ ok: true, skipped: "not_due" });
    expect(calMock.watchEvents).not.toHaveBeenCalled();
  });

  it("renews channel when it expires in <5 days", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (1, 'old-ch', 'old-res', ?, 'old-tok')"
    ).run(soon);

    const result = await handleCalendarRenew(db, "https://example.com");

    expect(calMock.stopChannel).toHaveBeenCalledWith(expect.anything(), "old-ch", "old-res");
    expect(calMock.watchEvents).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, renewed: true });

    const row = db
      .prepare("SELECT channel_id, sync_token FROM calendar_sync_state WHERE id = 1")
      .get() as { channel_id: string; sync_token: string };
    expect(row.channel_id).toBe("new-ch");
    expect(row.sync_token).toBe("new-tok");
  });

  it("does initial setup when no state row exists", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");

    const result = await handleCalendarRenew(db, "https://example.com");

    expect(calMock.stopChannel).not.toHaveBeenCalled();
    expect(calMock.watchEvents).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, renewed: true });
  });
});
