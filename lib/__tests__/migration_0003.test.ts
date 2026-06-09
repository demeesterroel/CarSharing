import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";

describe("migration 0003", () => {
  it("adds client_id and updated_at to trips", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(trips)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("client_id");
    expect(names).toContain("updated_at");
  });

  it("adds the same columns to fuel_fillups, expenses, reservations", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    for (const t of ["fuel_fillups", "expenses", "reservations"]) {
      const cols = db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names, `${t} missing client_id`).toContain("client_id");
      expect(names, `${t} missing updated_at`).toContain("updated_at");
    }
  });

  it("enforces UNIQUE on client_id per table", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    // seed
    db.exec("INSERT INTO people (id,first_name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
    db.prepare(
      "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,client_id) VALUES (?,?,?,?,?,?,?,?)"
    ).run(1, 1, "2026-01-01", 0, 0, 0, 0, "abc");
    expect(() =>
      db
        .prepare(
          "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,client_id) VALUES (?,?,?,?,?,?,?,?)"
        )
        .run(1, 1, "2026-01-02", 0, 0, 0, 0, "abc")
    ).toThrow(/UNIQUE/i);
  });

  it("populates updated_at with a default of CURRENT_TIMESTAMP on insert", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec("INSERT INTO people (id,first_name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
    db.prepare(
      "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount) VALUES (?,?,?,?,?,?,?)"
    ).run(1, 1, "2026-01-01", 0, 0, 0, 0);
    const row = db.prepare("SELECT updated_at FROM trips LIMIT 1").get() as { updated_at: string };
    expect(row.updated_at).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
