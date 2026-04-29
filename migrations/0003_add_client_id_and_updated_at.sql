-- migrations/0003_add_client_id_and_updated_at.sql
-- Adds client_id (for idempotent offline inserts) and updated_at (for conflict detection)
-- to every mutable member-facing table.

ALTER TABLE trips         ADD COLUMN client_id TEXT;
ALTER TABLE fuel_fillups  ADD COLUMN client_id TEXT;
ALTER TABLE expenses      ADD COLUMN client_id TEXT;
ALTER TABLE reservations  ADD COLUMN client_id TEXT;

-- SQLite ALTER TABLE only supports constant literal defaults.
-- We use a fixed sentinel so existing rows have a consistent value;
-- triggers and INSERT logic will set real timestamps going forward.
ALTER TABLE trips         ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE fuel_fillups  ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE expenses      ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE reservations  ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_client_id        ON trips(client_id)        WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_fillups_client_id ON fuel_fillups(client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_client_id     ON expenses(client_id)     WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_client_id ON reservations(client_id) WHERE client_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_trips_updated_at        AFTER UPDATE ON trips        FOR EACH ROW BEGIN UPDATE trips        SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_fuel_fillups_updated_at AFTER UPDATE ON fuel_fillups FOR EACH ROW BEGIN UPDATE fuel_fillups SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_expenses_updated_at     AFTER UPDATE ON expenses     FOR EACH ROW BEGIN UPDATE expenses     SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_reservations_updated_at AFTER UPDATE ON reservations FOR EACH ROW BEGIN UPDATE reservations SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
