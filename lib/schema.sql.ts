import type Database from "better-sqlite3";

export function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      discount      REAL    NOT NULL DEFAULT 0,
      discount_long REAL    NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cars (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      short        TEXT    NOT NULL UNIQUE,
      name         TEXT    NOT NULL,
      price_per_km REAL    NOT NULL,
      brand        TEXT,
      color        TEXT
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
      end_date   TEXT    NOT NULL
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
}
