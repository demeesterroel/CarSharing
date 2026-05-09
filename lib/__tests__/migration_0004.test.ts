import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";

describe("migration 0004 — car owner era", () => {
  it("adds owner_from and owner_to to cars", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("owner_from");
    expect(names).toContain("owner_to");
  });

  it("backfills owner_from for cars with owner_name", () => {
    // Pre-seed data BEFORE running migrations
    const db2 = new Database(":memory:");
    db2.exec(`
      CREATE TABLE _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE cars (id INTEGER PRIMARY KEY AUTOINCREMENT, short TEXT NOT NULL, name TEXT NOT NULL, price_per_km REAL NOT NULL, owner_name TEXT);
      INSERT INTO cars (short, name, price_per_km, owner_name) VALUES ('XX', 'Test', 0.2, 'Alice');
    `);
    // Mark all migrations except 0004 as already applied so only the backfill runs
    db2.exec(`
      INSERT INTO _migrations (filename) VALUES ('0001_initial_schema.sql');
      INSERT INTO _migrations (filename) VALUES ('0002_data_corrections_trips.sql');
      INSERT INTO _migrations (filename) VALUES ('0003_add_client_id_and_updated_at.sql');
      INSERT INTO _migrations (filename) VALUES ('0005_add_settlements_table.sql');
      INSERT INTO _migrations (filename) VALUES ('0006_settings_table.sql');
      INSERT INTO _migrations (filename) VALUES ('0007_settled_outside.sql');
      INSERT INTO _migrations (filename) VALUES ('0008_drop_fixed_costs_json.sql');
      INSERT INTO _migrations (filename) VALUES ('0009_updated_at_admin_tables.sql');
      INSERT INTO _migrations (filename) VALUES ('0010_people_bank_account.sql');
    `);
    runMigrations(db2);
    const car = db2.prepare("SELECT owner_from FROM cars WHERE short = 'XX'").get() as {
      owner_from: string | null;
    };
    expect(car.owner_from).toBe("2018-01-01");
  });

  it("creates the settlements table", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).toContain("settlements");
  });

  it("settlements table has correct columns", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(settlements)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("year");
    expect(names).toContain("settled_at");
    expect(names).toContain("settled_by");
  });
});
