import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";

function makeDb() {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

/**
 * Hand-rolled schema representing the state AFTER migration 0014 (before 0015).
 * Columns added by 0015–0022 are intentionally absent so those migrations can run.
 */
function buildDbAt0014(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- people: has name (pre-0015), no first_name/last_name, no email, no theme_preference,
    --         no session_epoch (those come in 0011, 0015, 0018, 0021)
    CREATE TABLE people (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL DEFAULT '',
      discount      REAL    NOT NULL DEFAULT 0,
      discount_long REAL    NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      username      TEXT    UNIQUE,
      password_hash TEXT,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      updated_at    TEXT    NOT NULL DEFAULT '1970-01-01 00:00:00',
      bank_account  TEXT    NOT NULL DEFAULT '',
      email         TEXT
    );

    -- invite_tokens: no purpose column yet (comes in 0022)
    CREATE TABLE invite_tokens (
      token      TEXT    PRIMARY KEY,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      expires_at TEXT    NOT NULL
    );

    -- cars: still has owner_name (dropped in 0016), no owner_person_id yet (comes in 0012)
    CREATE TABLE cars (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      short            TEXT    NOT NULL UNIQUE,
      name             TEXT    NOT NULL,
      price_per_km     REAL    NOT NULL,
      brand            TEXT,
      color            TEXT,
      owner_name       TEXT,
      long_threshold   INTEGER NOT NULL DEFAULT 500,
      active           INTEGER NOT NULL DEFAULT 1,
      expected_km      INTEGER,
      owner_from       TEXT,
      owner_to         TEXT,
      updated_at       TEXT    NOT NULL DEFAULT '1970-01-01 00:00:00',
      owner_person_id  INTEGER REFERENCES people(id)
    );

    CREATE TABLE trips (
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
      gps_coords     TEXT,
      client_id      TEXT    UNIQUE,
      updated_at     TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE fuel_fillups (
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
      full_tank       INTEGER NOT NULL DEFAULT 0,
      client_id       TEXT    UNIQUE,
      updated_at      TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      settled_outside INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE expenses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id          INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date            TEXT    NOT NULL,
      amount          REAL    NOT NULL,
      description     TEXT,
      category        TEXT,
      client_id       TEXT    UNIQUE,
      updated_at      TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      settled_outside INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE reservations (
      id                         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id                  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id                     INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      start_date                 TEXT    NOT NULL,
      end_date                   TEXT    NOT NULL,
      status                     TEXT    NOT NULL DEFAULT 'pending',
      note                       TEXT,
      client_id                  TEXT    UNIQUE,
      updated_at                 TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      google_event_id            TEXT,
      last_synced_etag           TEXT,
      last_app_write_nonce       TEXT,
      last_known_response_status TEXT
    );

    CREATE TABLE payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      date       TEXT    NOT NULL,
      amount     REAL    NOT NULL,
      note       TEXT,
      year       INTEGER NOT NULL,
      updated_at TEXT    NOT NULL DEFAULT '1970-01-01 00:00:00'
    );

    CREATE TABLE settlements (
      year       INTEGER PRIMARY KEY,
      settled_at TEXT    NOT NULL,
      settled_by TEXT    NOT NULL,
      updated_at TEXT    NOT NULL DEFAULT '1970-01-01 00:00:00'
    );

    CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'
    );

    CREATE TABLE car_price_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id         INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
      price_per_km   REAL    NOT NULL,
      effective_from TEXT    NOT NULL
    );

    CREATE TABLE calendar_sync_state (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      channel_id    TEXT NOT NULL,
      resource_id   TEXT NOT NULL,
      expiration_at TEXT NOT NULL,
      sync_token    TEXT NOT NULL
    );

    -- Triggers as created by 0009 (the buggy versions referencing OLD.id for settlements/settings
    -- are fine here; 0016 will fix them before doing the DROP COLUMN).
    CREATE TRIGGER IF NOT EXISTS trg_payments_updated_at
      AFTER UPDATE ON payments FOR EACH ROW
      BEGIN UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
    CREATE TRIGGER IF NOT EXISTS trg_cars_updated_at
      AFTER UPDATE ON cars FOR EACH ROW
      BEGIN UPDATE cars SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
    CREATE TRIGGER IF NOT EXISTS trg_people_updated_at
      AFTER UPDATE ON people FOR EACH ROW
      BEGIN UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
    CREATE TRIGGER IF NOT EXISTS trg_settlements_updated_at
      AFTER UPDATE ON settlements FOR EACH ROW
      BEGIN UPDATE settlements SET updated_at = CURRENT_TIMESTAMP WHERE year = OLD.year; END;
    CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
      AFTER UPDATE ON settings FOR EACH ROW
      BEGIN UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = OLD.key; END;
  `);

  // Mark 0001–0014 as applied so only 0015+ run
  const appliedUpTo0014 = [
    "0001_initial_schema.sql",
    "0002_data_corrections_trips.sql",
    "0003_add_client_id_and_updated_at.sql",
    "0004_add_car_owner_era.sql",
    "0005_add_settlements_table.sql",
    "0006_settings_table.sql",
    "0007_settled_outside.sql",
    "0008_drop_fixed_costs_json.sql",
    "0009_updated_at_admin_tables.sql",
    "0010_people_bank_account.sql",
    "0011_people_email.sql",
    "0012_cars_owner_person_id.sql",
    "0013_reservation_calendar_columns.sql",
    "0014_calendar_sync_state.sql",
  ];
  for (const f of appliedUpTo0014) {
    db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(f);
  }

  return db;
}

describe("migration 0015 — first_name / last_name columns", () => {
  it("adds first_name column to people", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "first_name");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("''");
  });

  it("adds last_name column to people", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "last_name");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("''");
  });

  it("backfills first_name and last_name by splitting name on first space", () => {
    const db = buildDbAt0014();

    // Insert people with two-word and one-word names
    db.exec(`INSERT INTO people (id, name, active) VALUES (1, 'Alice Wonderland', 1)`);
    db.exec(`INSERT INTO people (id, name, active) VALUES (2, 'Bob', 1)`);
    db.exec(`INSERT INTO people (id, name, active) VALUES (3, 'Charlie De Bie', 1)`);

    runMigrations(db);

    const people = db.prepare("SELECT id, first_name, last_name FROM people ORDER BY id").all() as {
      id: number;
      first_name: string;
      last_name: string;
    }[];

    // 'Alice Wonderland' → first_name='Alice', last_name='Wonderland'
    expect(people[0].first_name).toBe("Alice");
    expect(people[0].last_name).toBe("Wonderland");

    // 'Bob' → first_name='Bob', last_name=''
    expect(people[1].first_name).toBe("Bob");
    expect(people[1].last_name).toBe("");

    // 'Charlie De Bie' → split on FIRST space → first_name='Charlie', last_name='De Bie'
    expect(people[2].first_name).toBe("Charlie");
    expect(people[2].last_name).toBe("De Bie");
  });
});

describe("migration 0016 — drop owner_name from cars", () => {
  it("owner_name column no longer exists on cars", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("owner_name");
  });

  it("cars table still has short and name columns after drop", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("short");
    expect(names).toContain("name");
  });

  it("fixed settlements trigger fires correctly (uses year PK, not id)", () => {
    const db = makeDb();
    db.exec(
      "INSERT INTO settlements (year, settled_at, settled_by) VALUES (2025, '2025-12-31', 'admin')"
    );
    db.exec("UPDATE settlements SET updated_at = '1970-01-01 00:00:00' WHERE year = 2025");
    db.exec("UPDATE settlements SET settled_by = 'newadmin' WHERE year = 2025");
    const row = db.prepare("SELECT updated_at FROM settlements WHERE year = 2025").get() as {
      updated_at: string;
    };
    expect(row.updated_at).not.toBe("1970-01-01 00:00:00");
  });

  it("fixed settings trigger fires correctly (uses key PK, not id)", () => {
    const db = makeDb();
    db.exec(
      "UPDATE settings SET updated_at = '1970-01-01 00:00:00' WHERE key = 'coop_bank_account'"
    );
    db.exec("UPDATE settings SET value = 'BE00000000000000' WHERE key = 'coop_bank_account'");
    const row = db
      .prepare("SELECT updated_at FROM settings WHERE key = 'coop_bank_account'")
      .get() as {
      updated_at: string;
    };
    expect(row.updated_at).not.toBe("1970-01-01 00:00:00");
  });
});

describe("migration 0017 — drop people name column", () => {
  it("name column no longer exists on people after migration", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("name");
  });

  it("first_name and last_name are the authoritative name columns", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("first_name");
    expect(names).toContain("last_name");
  });
});
