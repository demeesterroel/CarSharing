import type Database from "better-sqlite3";

export function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      discount      REAL    NOT NULL DEFAULT 0,
      discount_long REAL    NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      username      TEXT    UNIQUE,
      password_hash TEXT,
      is_admin      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      token      TEXT    PRIMARY KEY,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      expires_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cars (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      short           TEXT    NOT NULL UNIQUE,
      name            TEXT    NOT NULL,
      price_per_km    REAL    NOT NULL,
      brand           TEXT,
      color           TEXT,
      owner_name      TEXT,
      long_threshold  INTEGER NOT NULL DEFAULT 500,
      fixed_costs_json TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id      INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id         INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date           TEXT    NOT NULL,
      start_odometer INTEGER NOT NULL,
      end_odometer   INTEGER NOT NULL,
      km             INTEGER NOT NULL,
      amount         REAL    NOT NULL,
      location       TEXT
    );

    CREATE TABLE IF NOT EXISTS fuel_fillups (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id          INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date            TEXT    NOT NULL,
      amount          REAL    NOT NULL,
      liters          REAL    NOT NULL,
      price_per_liter REAL    NOT NULL,
      odometer        INTEGER,
      receipt         TEXT,
      location        TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id      INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date        TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id     INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      start_date TEXT    NOT NULL,
      end_date   TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'pending',
      note       TEXT
    );

    CREATE TABLE IF NOT EXISTS car_price_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id         INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
      price_per_km   REAL    NOT NULL,
      effective_from TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      date      TEXT    NOT NULL,
      amount    REAL    NOT NULL,
      note      TEXT,
      year      INTEGER NOT NULL
    );
  `);

  // Migrations for existing databases (safe to run multiple times)
  const migrations = [
    "ALTER TABLE people ADD COLUMN username TEXT",
    "ALTER TABLE people ADD COLUMN password_hash TEXT",
    "ALTER TABLE people ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE reservations ADD COLUMN note TEXT",
    "ALTER TABLE cars ADD COLUMN owner_name TEXT",
    "ALTER TABLE cars ADD COLUMN long_threshold INTEGER NOT NULL DEFAULT 500",
    "ALTER TABLE cars ADD COLUMN fixed_costs_json TEXT",
    "ALTER TABLE cars ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE cars ADD COLUMN expected_km INTEGER",
    "ALTER TABLE trips ADD COLUMN parking TEXT",
    "ALTER TABLE trips ADD COLUMN gps_coords TEXT",
    "ALTER TABLE fuel_fillups ADD COLUMN gps_coords TEXT",
    "ALTER TABLE fuel_fillups ADD COLUMN full_tank INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN category TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}
