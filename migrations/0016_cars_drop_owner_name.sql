-- Remove the owner_name text column from cars.
-- SQLite (≥3.35) supports DROP COLUMN natively but validates ALL triggers first.
-- Migration 0009 created trg_settlements_updated_at and trg_settings_updated_at
-- referencing OLD.id, but neither table has an id column (settlements uses year,
-- settings uses key). Fix both triggers before the DROP COLUMN to avoid schema
-- validation failure.

DROP TRIGGER IF EXISTS trg_settlements_updated_at;
CREATE TRIGGER IF NOT EXISTS trg_settlements_updated_at
  AFTER UPDATE ON settlements FOR EACH ROW
  BEGIN
    UPDATE settlements SET updated_at = CURRENT_TIMESTAMP WHERE year = OLD.year;
  END;

DROP TRIGGER IF EXISTS trg_settings_updated_at;
CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
  AFTER UPDATE ON settings FOR EACH ROW
  BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = OLD.key;
  END;

ALTER TABLE cars DROP COLUMN owner_name;
