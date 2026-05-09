-- migrations/0009_updated_at_admin_tables.sql
-- Adds updated_at + AFTER UPDATE trigger to payments, cars, people, settlements, settings.
-- Existing rows get '1970-01-01 00:00:00' sentinel (historical value unknown).

ALTER TABLE payments    ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE cars        ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE people      ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE settlements ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE settings    ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';

CREATE TRIGGER IF NOT EXISTS trg_payments_updated_at    AFTER UPDATE ON payments    FOR EACH ROW BEGIN UPDATE payments    SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_cars_updated_at        AFTER UPDATE ON cars        FOR EACH ROW BEGIN UPDATE cars        SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_people_updated_at      AFTER UPDATE ON people      FOR EACH ROW BEGIN UPDATE people      SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_settlements_updated_at AFTER UPDATE ON settlements FOR EACH ROW BEGIN UPDATE settlements SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at    AFTER UPDATE ON settings    FOR EACH ROW BEGIN UPDATE settings    SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
