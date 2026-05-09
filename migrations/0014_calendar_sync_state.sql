CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id    TEXT NOT NULL DEFAULT '',
  resource_id   TEXT NOT NULL DEFAULT '',
  expiration_at TEXT NOT NULL DEFAULT '',
  sync_token    TEXT NOT NULL DEFAULT ''
);
