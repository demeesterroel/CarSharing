// lib/__tests__/calendar_sync_log.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { getRecentSyncLog, logSync, MAX_ROWS } from "../calendar-sync-log";
import { runMigrations } from "../db/migrate";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

describe("logSync / getRecentSyncLog", () => {
  it("persists an entry and reads it back", () => {
    const db = makeDb();
    logSync(db, {
      direction: "outbound",
      action: "create",
      reservationId: 7,
      googleEventId: "evt-1",
      detail: { start: "2026-06-01", nonce: "abc" },
    });

    const rows = getRecentSyncLog(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: "outbound",
      action: "create",
      reservation_id: 7,
      google_event_id: "evt-1",
      ok: 1,
    });
    expect(JSON.parse(rows[0].detail!)).toEqual({ start: "2026-06-01", nonce: "abc" });
  });

  it("stores ok:false as 0", () => {
    const db = makeDb();
    logSync(db, { direction: "outbound", action: "error", ok: false, detail: { message: "boom" } });
    expect(getRecentSyncLog(db)[0].ok).toBe(0);
  });

  it("returns rows newest-first and honours the limit", () => {
    const db = makeDb();
    for (let i = 0; i < 5; i++) {
      logSync(db, { direction: "inbound", action: "rsvp", reservationId: i });
    }
    const rows = getRecentSyncLog(db, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].reservation_id).toBe(4);
    expect(rows[1].reservation_id).toBe(3);
  });

  it("trims the table to MAX_ROWS (retention)", () => {
    const db = makeDb();
    for (let i = 0; i < MAX_ROWS + 5; i++) {
      logSync(db, { direction: "inbound", action: "webhook" });
    }
    const count = db.prepare("SELECT COUNT(*) AS n FROM calendar_sync_log").get() as { n: number };
    expect(count.n).toBe(MAX_ROWS);
  });

  it("never throws when the table is missing", () => {
    const db = new Database(":memory:");
    expect(() => logSync(db, { direction: "inbound", action: "webhook" })).not.toThrow();
  });
});
