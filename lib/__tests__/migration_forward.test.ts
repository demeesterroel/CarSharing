/**
 * Forward-migration test.
 *
 * Approach: build a DB at the state of migrations 0001–0010 by running
 * runMigrations with 0011–0022 pre-marked as "applied" (so they are skipped),
 * seed representative rows that match the schema AT THAT POINT, then clear the
 * fakes and run runMigrations again so 0011–0022 execute for real.
 *
 * This verifies:
 *   (a) seeded rows survive all later migrations
 *   (b) newly added columns appear with correct defaults / backfill
 *   (c) the _migrations log lists all 22 migrations
 *   (d) running runMigrations a third time is a no-op
 */

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";

// All 22 migration filenames in order
const ALL_MIGRATIONS = [
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
  "0015_people_first_last_name.sql",
  "0016_cars_drop_owner_name.sql",
  "0017_drop_people_name.sql",
  "0018_people_theme_preference.sql",
  "0019_default_theme_mono.sql",
  "0020_date_indexes.sql",
  "0021_people_session_epoch.sql",
  "0022_invite_tokens_purpose.sql",
  "0023_expenses_receipt.sql",
  "0024_calendar_sync_log.sql",
];

const LATER_MIGRATIONS = ALL_MIGRATIONS.slice(10); // 0011–0022

function buildDbAt0010(): Database.Database {
  const db = new Database(":memory:");

  // Phase 1: pre-mark 0011–0022 as applied so runMigrations only runs 0001–0010.
  // We must create the _migrations table first.
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  for (const f of LATER_MIGRATIONS) {
    db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(f);
  }

  // Now run migrations — only 0001–0010 will execute.
  runMigrations(db);

  return db;
}

describe("forward migration — 0001–0010 → 0011–0022", () => {
  it("seeds survive all later migrations", () => {
    const db = buildDbAt0010();

    // Seed a person (no first_name/last_name yet — those come in 0015).
    // At 0010 the people schema has: id, name, discount, discount_long, active,
    // username, password_hash, is_admin, updated_at, bank_account
    db.exec(
      "INSERT INTO people (id, name, discount, discount_long, active, bank_account) " +
        "VALUES (1, 'Alice Wonderland', 0, 0, 1, 'BE00000000000001')"
    );
    db.exec(
      "INSERT INTO people (id, name, discount, discount_long, active, bank_account) " +
        "VALUES (2, 'Bob', 0, 0, 1, '')"
    );

    // Seed a car (at 0010: no owner_person_id yet; owner_name still present)
    db.exec(
      "INSERT INTO cars (id, short, name, price_per_km, owner_name) " +
        "VALUES (1, 'XX', 'Test Car', 0.30, 'Alice Wonderland')"
    );

    // Seed a trip
    db.prepare(
      "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) " +
        "VALUES (?,?,?,?,?,?,?)"
    ).run(1, 1, "2024-06-01", 10000, 10150, 150, 45.0);

    // Seed a fuel fill-up
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter) " +
        "VALUES (?,?,?,?,?,?)"
    ).run(1, 1, "2024-06-05", 60.0, 40.0, 1.5);

    // Seed a payment
    db.prepare("INSERT INTO payments (person_id, date, amount, year) VALUES (?,?,?,?)").run(
      1,
      "2024-12-31",
      500.0,
      2024
    );

    // Now remove the fake _migrations entries so the real 0011–0022 execute.
    for (const f of LATER_MIGRATIONS) {
      db.prepare("DELETE FROM _migrations WHERE filename = ?").run(f);
    }

    // Run migrations 0011–0022
    runMigrations(db);

    // (a) Seeded person survived
    const person = db
      .prepare("SELECT id, first_name, last_name, bank_account FROM people WHERE id = 1")
      .get() as { id: number; first_name: string; last_name: string; bank_account: string };
    expect(person).toBeTruthy();
    expect(person.id).toBe(1);

    // (b) first_name / last_name backfilled from name (migration 0015)
    expect(person.first_name).toBe("Alice");
    expect(person.last_name).toBe("Wonderland");

    // bank_account preserved
    expect(person.bank_account).toBe("BE00000000000001");

    // Bob: single name → first_name='Bob', last_name=''
    const bob = db.prepare("SELECT first_name, last_name FROM people WHERE id = 2").get() as {
      first_name: string;
      last_name: string;
    };
    expect(bob.first_name).toBe("Bob");
    expect(bob.last_name).toBe("");

    // (b) name column is gone after 0017
    const peopleCols = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
    expect(peopleCols.map((c) => c.name)).not.toContain("name");

    // (b) email defaults to NULL (migration 0011)
    const emailRow = db.prepare("SELECT email FROM people WHERE id = 1").get() as {
      email: string | null;
    };
    expect(emailRow.email).toBeNull();

    // (b) theme_preference defaulted to 'paper' (0018), then updated to 'mono' (0019)
    // Rows that existed BEFORE 0018 had no theme_preference column; after 0018 they get
    // the column default 'paper'. 0019 then updates all 'paper' → 'mono'.
    const themeRow = db.prepare("SELECT theme_preference FROM people WHERE id = 1").get() as {
      theme_preference: string;
    };
    expect(themeRow.theme_preference).toBe("mono");

    // (b) session_epoch defaults to 0 (migration 0021)
    const epochRow = db.prepare("SELECT session_epoch FROM people WHERE id = 1").get() as {
      session_epoch: number;
    };
    expect(epochRow.session_epoch).toBe(0);

    // Seeded trip survived
    const trip = db.prepare("SELECT km, amount FROM trips WHERE car_id = 1").get() as {
      km: number;
      amount: number;
    };
    expect(trip).toBeTruthy();
    expect(trip.km).toBe(150);
    expect(trip.amount).toBe(45.0);

    // Seeded fuel fill-up survived
    const fuel = db.prepare("SELECT amount FROM fuel_fillups WHERE car_id = 1").get() as {
      amount: number;
    };
    expect(fuel.amount).toBe(60.0);

    // Seeded payment survived
    const payment = db.prepare("SELECT amount, year FROM payments WHERE person_id = 1").get() as {
      amount: number;
      year: number;
    };
    expect(payment.amount).toBe(500.0);
    expect(payment.year).toBe(2024);

    // (b) owner_name dropped from cars (migration 0016)
    const carCols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    expect(carCols.map((c) => c.name)).not.toContain("owner_name");

    // (b) owner_person_id added to cars (migration 0012)
    expect(carCols.map((c) => c.name)).toContain("owner_person_id");

    // (c) _migrations log lists all migrations
    const applied = db
      .prepare("SELECT filename FROM _migrations ORDER BY filename")
      .pluck()
      .all() as string[];
    expect(applied).toHaveLength(24);
    for (const f of ALL_MIGRATIONS) {
      expect(applied).toContain(f);
    }

    // (d) running runMigrations again is a no-op
    expect(() => runMigrations(db)).not.toThrow();
    const appliedAfter = db
      .prepare("SELECT filename FROM _migrations ORDER BY filename")
      .pluck()
      .all() as string[];
    expect(appliedAfter).toHaveLength(24);
  });
});
