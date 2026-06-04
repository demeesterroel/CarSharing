// lib/calendar-sync-log.ts
// Persistent, queryable log of Google Calendar 2-way sync events (#338).
// Writing must never throw into the sync path — all failures are swallowed.
import type Database from "better-sqlite3";

export type SyncDirection = "outbound" | "inbound";

export interface SyncLogEntry {
  direction: SyncDirection;
  /** create | update | delete | rsvp | time-overwrite | echo-skip | webhook | error */
  action: string;
  reservationId?: number | null;
  googleEventId?: string | null;
  /** false marks a failure; defaults to true. */
  ok?: boolean;
  /** Arbitrary context, JSON-serialized (dates, status, nonce, etag, error message). */
  detail?: unknown;
}

export interface SyncLogRow {
  id: number;
  created_at: string;
  direction: string;
  action: string;
  reservation_id: number | null;
  google_event_id: string | null;
  ok: number;
  detail: string | null;
}

// Keep the table bounded — calendars can be chatty. Roughly a few weeks of
// activity for a small fleet; oldest rows are trimmed on each insert.
export const MAX_ROWS = 2000;

export function logSync(db: Database.Database, entry: SyncLogEntry): void {
  try {
    db.prepare(
      `INSERT INTO calendar_sync_log (direction, action, reservation_id, google_event_id, ok, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      entry.direction,
      entry.action,
      entry.reservationId ?? null,
      entry.googleEventId ?? null,
      entry.ok === false ? 0 : 1,
      entry.detail === undefined ? null : safeStringify(entry.detail)
    );
    // Retention: drop everything older than the most recent MAX_ROWS rows.
    db.prepare(
      `DELETE FROM calendar_sync_log
       WHERE id <= (SELECT MAX(id) FROM calendar_sync_log) - ?`
    ).run(MAX_ROWS);
  } catch (e) {
    // Logging is best-effort — never break the sync it is observing.
    console.error("[calendar-sync-log] insert failed", e);
  }
}

export function getRecentSyncLog(db: Database.Database, limit = 200): SyncLogRow[] {
  return db
    .prepare(
      `SELECT id, created_at, direction, action, reservation_id, google_event_id, ok, detail
       FROM calendar_sync_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as SyncLogRow[];
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
