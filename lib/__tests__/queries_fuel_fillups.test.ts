// lib/__tests__/queries_fuel_fillups.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import {
  getFuelFillups,
  getFuelFillupById,
  insertFuelFillup,
  updateFuelFillup,
  deleteFuelFillup,
  ConflictError,
} from "../queries/fuel-fillups";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  db.exec(`INSERT INTO people (id, name, first_name, last_name, active) VALUES (1, 'Alice Owner', 'Alice', 'Owner', 1), (2, 'Bob Member', 'Bob', 'Member', 1)`);
  db.exec(
    `INSERT INTO cars (id, short, name, price_per_km, owner_person_id, owner_from, active) VALUES (1, 'CA', 'Car A', 0.2, 1, '2020-01-01', 1)`
  );
}

const baseFillup = {
  person_id: 1,
  car_id: 1,
  date: "2026-03-15",
  amount: 60,
  liters: 40,
  odometer: 12000,
  receipt: null,
  location: "Shell Station",
};

describe("getFuelFillups", () => {
  it("returns empty array when no fillups exist", () => {
    const db = makeDb();
    seed(db);
    expect(getFuelFillups(db)).toEqual([]);
  });

  it("returns fillups with joined person_name and car_short", () => {
    const db = makeDb();
    seed(db);
    insertFuelFillup(db, baseFillup);
    const list = getFuelFillups(db);
    expect(list).toHaveLength(1);
    expect(list[0].person_name).toBe("Alice");
    expect(list[0].car_short).toBe("CA");
    expect(list[0].amount).toBe(60);
  });

  it("orders by date DESC then id DESC", () => {
    const db = makeDb();
    seed(db);
    insertFuelFillup(db, { ...baseFillup, date: "2026-01-01", amount: 30 });
    insertFuelFillup(db, { ...baseFillup, date: "2026-05-01", amount: 70 });
    const list = getFuelFillups(db);
    expect(list[0].amount).toBe(70);
    expect(list[1].amount).toBe(30);
  });
});

describe("getFuelFillupById", () => {
  it("returns the correct fillup", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, baseFillup);
    const fillup = getFuelFillupById(db, id);
    expect(fillup?.id).toBe(id);
    expect(fillup?.liters).toBe(40);
    expect(fillup?.location).toBe("Shell Station");
    expect(fillup?.person_name).toBe("Alice");
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(getFuelFillupById(db, 9999)).toBeNull();
  });
});

describe("insertFuelFillup", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, baseFillup);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("computes price_per_liter automatically", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, { ...baseFillup, amount: 60, liters: 40 });
    const fillup = getFuelFillupById(db, id);
    expect(fillup?.price_per_liter).toBeCloseTo(1.5);
  });

  it("stores full_tank flag", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, { ...baseFillup, full_tank: 1 });
    expect(getFuelFillupById(db, id)?.full_tank).toBe(1);
  });

  it("stores settled_outside flag", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, { ...baseFillup, settled_outside: 1 });
    expect(getFuelFillupById(db, id)?.settled_outside).toBe(1);
  });

  it("stores gps_coords when provided", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, { ...baseFillup, gps_coords: "51.2,4.4" });
    expect(getFuelFillupById(db, id)?.gps_coords).toBe("51.2,4.4");
  });

  it("idempotency: returns existing id when client_id already exists", () => {
    const db = makeDb();
    seed(db);
    const id1 = insertFuelFillup(db, { ...baseFillup, client_id: "fuel-xyz" });
    const id2 = insertFuelFillup(db, { ...baseFillup, amount: 99, client_id: "fuel-xyz" });
    expect(id2).toBe(id1);
    expect(getFuelFillups(db)).toHaveLength(1);
  });

  it("creates a new row when client_id is null", () => {
    const db = makeDb();
    seed(db);
    insertFuelFillup(db, { ...baseFillup });
    insertFuelFillup(db, { ...baseFillup });
    expect(getFuelFillups(db)).toHaveLength(2);
  });
});

describe("updateFuelFillup", () => {
  it("updates all fields of a fillup", () => {
    const db = makeDb();
    seed(db);
    db.exec(`INSERT INTO people (id, name, first_name, last_name, active) VALUES (3, 'Carol', 'Carol', '', 1)`);
    const id = insertFuelFillup(db, baseFillup);
    updateFuelFillup(db, id, {
      person_id: 3,
      car_id: 1,
      date: "2026-06-20",
      amount: 80,
      liters: 50,
      odometer: 15000,
      receipt: "receipt.pdf",
      location: "Total Station",
      gps_coords: "51.1,4.5",
      full_tank: 1,
      settled_outside: 1,
    });
    const fillup = getFuelFillupById(db, id);
    expect(fillup?.person_name).toBe("Carol");
    expect(fillup?.date).toBe("2026-06-20");
    expect(fillup?.amount).toBe(80);
    expect(fillup?.liters).toBe(50);
    expect(fillup?.odometer).toBe(15000);
    expect(fillup?.receipt).toBe("receipt.pdf");
    expect(fillup?.location).toBe("Total Station");
    expect(fillup?.full_tank).toBe(1);
    expect(fillup?.settled_outside).toBe(1);
    // price_per_liter recalculated: 80/50 = 1.6
    expect(fillup?.price_per_liter).toBeCloseTo(1.6);
  });

  it("with expectedUpdatedAt: succeeds when timestamp matches", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, baseFillup);
    const fillup = getFuelFillupById(db, id)!;
    expect(() =>
      updateFuelFillup(
        db,
        id,
        { ...baseFillup, amount: 55, liters: 35 },
        { expectedUpdatedAt: fillup.updated_at }
      )
    ).not.toThrow();
  });

  it("with expectedUpdatedAt: throws ConflictError when timestamp mismatches", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, baseFillup);
    expect(() =>
      updateFuelFillup(
        db,
        id,
        { ...baseFillup, amount: 55, liters: 35 },
        { expectedUpdatedAt: "1999-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });

  it("with expectedUpdatedAt: throws ConflictError when fillup no longer exists", () => {
    const db = makeDb();
    seed(db);
    expect(() =>
      updateFuelFillup(db, 9999, { ...baseFillup }, { expectedUpdatedAt: "2026-01-01 00:00:00" })
    ).toThrow(ConflictError);
  });
});

describe("deleteFuelFillup", () => {
  it("removes the fillup from the DB", () => {
    const db = makeDb();
    seed(db);
    const id = insertFuelFillup(db, baseFillup);
    deleteFuelFillup(db, id);
    expect(getFuelFillupById(db, id)).toBeNull();
    expect(getFuelFillups(db)).toHaveLength(0);
  });

  it("does not throw for non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(() => deleteFuelFillup(db, 9999)).not.toThrow();
  });
});
