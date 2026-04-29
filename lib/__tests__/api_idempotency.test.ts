import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { insertTrip, updateTrip, ConflictError } from "../queries/trips";
import { insertFuelFillup } from "../queries/fuel-fillups";
import { insertExpense } from "../queries/expenses";
import { insertReservation } from "../queries/reservations";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedPeopleAndCars(db: Database.Database) {
  db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
  db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------
describe("insertTrip idempotency", () => {
  it("returns the same id for repeated client_id (no duplicate insert)", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const input = {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 100,
      end_odometer: 150,
      location: null,
      client_id: "uuid-1",
    };
    const idA = insertTrip(db, input);
    const idB = insertTrip(db, input);
    expect(idA).toBe(idB);
    // Only 1 row with this client_id should exist.
    const count = db
      .prepare("SELECT COUNT(*) c FROM trips WHERE client_id = ?")
      .get("uuid-1") as { c: number };
    expect(count.c).toBe(1);
  });

  it("creates two rows when client_id differs", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const idA = insertTrip(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 0,
      end_odometer: 50,
      location: null,
      client_id: "u-1",
    });
    const idB = insertTrip(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 50,
      end_odometer: 80,
      location: null,
      client_id: "u-2",
    });
    expect(idA).not.toBe(idB);
  });

  it("creates a row when client_id is null (legacy)", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const id = insertTrip(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 0,
      end_odometer: 50,
      location: null,
    });
    expect(id).toBeGreaterThan(0);
  });
});

describe("updateTrip conflict check", () => {
  it("throws ConflictError when expectedUpdatedAt is older than DB", () => {
    const db = makeDb();
    seedPeopleAndCars(db);
    const id = insertTrip(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 0,
      end_odometer: 50,
      location: null,
    });

    // Pass a stale (past) timestamp as expectedUpdatedAt.
    // The DB row's updated_at is datetime('now'), which is newer.
    const staleTimestamp = "1970-01-01 00:00:00";

    expect(() =>
      updateTrip(
        db,
        id,
        {
          person_id: 1,
          car_id: 1,
          date: "2026-04-27",
          start_odometer: 0,
          end_odometer: 50,
          location: null,
        },
        { expectedUpdatedAt: staleTimestamp }
      )
    ).toThrow(ConflictError);
  });

  it("succeeds without expectedUpdatedAt (no conflict check)", () => {
    const db = makeDb();
    seedPeopleAndCars(db);
    const id = insertTrip(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      start_odometer: 0,
      end_odometer: 50,
      location: null,
    });
    expect(() =>
      updateTrip(db, id, {
        person_id: 1,
        car_id: 1,
        date: "2026-04-27",
        start_odometer: 0,
        end_odometer: 60,
        location: null,
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Fuel
// ---------------------------------------------------------------------------
describe("insertFuelFillup idempotency", () => {
  it("returns the same id for repeated client_id", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const input = {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      amount: 50,
      liters: 30,
      odometer: null,
      receipt: null,
      location: null,
      client_id: "fuel-uuid-1",
    };
    const idA = insertFuelFillup(db, input);
    const idB = insertFuelFillup(db, input);
    expect(idA).toBe(idB);
    const count = db.prepare("SELECT COUNT(*) c FROM fuel_fillups").get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("creates two rows when client_id differs", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const idA = insertFuelFillup(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      amount: 50,
      liters: 30,
      odometer: null,
      receipt: null,
      location: null,
      client_id: "fuel-u-1",
    });
    const idB = insertFuelFillup(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      amount: 60,
      liters: 35,
      odometer: null,
      receipt: null,
      location: null,
      client_id: "fuel-u-2",
    });
    expect(idA).not.toBe(idB);
  });
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
describe("insertExpense idempotency", () => {
  it("returns the same id for repeated client_id", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const input = {
      person_id: 1,
      car_id: 1,
      date: "2026-04-27",
      amount: 25,
      description: "oil change",
      category: null,
      client_id: "exp-uuid-1",
    };
    const idA = insertExpense(db, input);
    const idB = insertExpense(db, input);
    expect(idA).toBe(idB);
    const count = db.prepare("SELECT COUNT(*) c FROM expenses").get() as { c: number };
    expect(count.c).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
describe("insertReservation idempotency", () => {
  it("returns the same id for repeated client_id", () => {
    const db = makeDb();
    seedPeopleAndCars(db);

    const input = {
      person_id: 1,
      car_id: 1,
      start_date: "2026-05-01",
      end_date: "2026-05-03",
      client_id: "res-uuid-1",
    };
    const idA = insertReservation(db, input);
    const idB = insertReservation(db, input);
    expect(idA).toBe(idB);
    const count = db.prepare("SELECT COUNT(*) c FROM reservations").get() as { c: number };
    expect(count.c).toBe(1);
  });
});
