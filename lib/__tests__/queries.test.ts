import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../schema.sql";
import { getPeople, insertPerson, getPersonById } from "../queries/people";
import { getCars, insertCar } from "../queries/cars";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

describe("people queries", () => {
  it("inserts and retrieves a person", () => {
    const db = makeDb();
    const id = insertPerson(db, { name: "Roeland", discount: 0, discount_long: 0, active: 1 });
    const person = getPersonById(db, id);
    expect(person?.name).toBe("Roeland");
  });

  it("returns empty array when no people", () => {
    const db = makeDb();
    expect(getPeople(db)).toEqual([]);
  });
});

describe("cars queries", () => {
  it("inserts and retrieves cars", () => {
    const db = makeDb();
    insertCar(db, { short: "JF", name: "Jean-Francois", price_per_km: 0.20, brand: "Toyota", color: "wit" });
    const cars = getCars(db);
    expect(cars).toHaveLength(1);
    expect(cars[0].short).toBe("JF");
  });
});
