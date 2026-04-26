import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";

describe("runMigrations", () => {
  it("creates all 9 tables", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual([
      "_migrations", "car_price_history", "cars", "expenses", "fuel_fillups", "invite_tokens", "payments", "people", "reservations", "trips"
    ]);
  });

  it("enforces foreign keys", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    expect(() =>
      db.prepare(
        "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount) VALUES (999,999,'2026-01-01',0,0,0,0)"
      ).run()
    ).toThrow();
  });

  it("records applied migrations in _migrations", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const applied = db.prepare("SELECT filename FROM _migrations ORDER BY filename").pluck().all() as string[];
    expect(applied).toContain("0001_initial_schema.sql");
  });

  it("is idempotent — running twice does not throw", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
