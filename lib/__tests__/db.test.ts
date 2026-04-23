import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../schema.sql";

describe("applySchema", () => {
  it("creates all 9 tables", () => {
    const db = new Database(":memory:");
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual([
      "car_price_history", "cars", "expenses", "fuel_fillups", "invite_tokens", "payments", "people", "reservations", "trips"
    ]);
  });

  it("enforces foreign keys", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchema(db);
    expect(() =>
      db.prepare(
        "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount) VALUES (999,999,'2026-01-01',0,0,0,0)"
      ).run()
    ).toThrow();
  });
});
