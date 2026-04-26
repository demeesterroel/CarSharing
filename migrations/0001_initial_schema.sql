-- Full schema as of 2026-04-26.
-- CREATE TABLE IF NOT EXISTS is a no-op on existing databases.
-- New installs get the complete schema in one shot.

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
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  short            TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  price_per_km     REAL    NOT NULL,
  brand            TEXT,
  color            TEXT,
  owner_name       TEXT,
  long_threshold   INTEGER NOT NULL DEFAULT 500,
  fixed_costs_json TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  expected_km      INTEGER
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
  location       TEXT,
  parking        TEXT,
  gps_coords     TEXT
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
  location        TEXT,
  gps_coords      TEXT,
  full_tank       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  car_id      INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
  date        TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  description TEXT,
  category    TEXT
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
