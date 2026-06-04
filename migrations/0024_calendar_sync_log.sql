-- Persistent log of Google Calendar 2-way sync events (#338).
-- Lives in the DB (on the mounted volume) so it survives container redeploys,
-- unlike the previous console.error-only logging. Bounded by a retention trim
-- in lib/calendar-sync-log.ts.
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  direction       TEXT NOT NULL,           -- 'outbound' (app -> GCal) | 'inbound' (GCal -> app)
  action          TEXT NOT NULL,           -- create|update|delete|rsvp|time-overwrite|echo-skip|webhook|error
  reservation_id  INTEGER,
  google_event_id TEXT,
  ok              INTEGER NOT NULL DEFAULT 1,
  detail          TEXT                      -- JSON blob with context (dates, status, nonce, etag, error message)
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_id_desc ON calendar_sync_log(id DESC);
