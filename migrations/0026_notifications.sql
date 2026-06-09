-- In-app notification storage for per-user notification preferences and
-- notification records (#358).

-- Notification records
CREATE TABLE IF NOT EXISTS notifications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_person_id INTEGER NOT NULL,
  type               TEXT NOT NULL,
  entity_type        TEXT NOT NULL,
  entity_id          INTEGER NOT NULL,
  message            TEXT NOT NULL,
  read_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_person_id, read_at);

-- Per-person notification preferences (default 'off' = no notifications)
ALTER TABLE people ADD COLUMN notify_new_reservations    TEXT NOT NULL DEFAULT 'off';
ALTER TABLE people ADD COLUMN notify_reservation_updates TEXT NOT NULL DEFAULT 'off';
ALTER TABLE people ADD COLUMN notify_new_trips           TEXT NOT NULL DEFAULT 'off';
