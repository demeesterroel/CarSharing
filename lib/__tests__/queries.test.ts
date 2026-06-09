import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import { getLastCarState } from "../queries/car-state";
import { getCars, insertCar } from "../queries/cars";
import { getDashboard } from "../queries/dashboard";
import { insertExpense } from "../queries/expenses";
import { insertFuelFillup } from "../queries/fuel-fillups";
import { insertPayment } from "../queries/payments";
import { getPeople, getPersonById, insertPerson } from "../queries/people";
import { getTrips, insertTrip } from "../queries/trips";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = {
  first_name: "",
  last_name: "",
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
  bank_account: "",
  email: null,
  theme_preference: "paper" as const,
};

describe("people queries", () => {
  it("inserts and retrieves a person", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const person = getPersonById(db, id);
    expect(person?.first_name).toBe("Alice");
  });

  it("returns empty array when no people", () => {
    const db = makeDb();
    expect(getPeople(db)).toEqual([]);
  });
});

describe("cars queries", () => {
  it("inserts and retrieves cars", () => {
    const db = makeDb();
    insertCar(db, {
      short: "JF",
      name: "Car JF",
      price_per_km: 0.2,
      brand: "Toyota",
      color: "wit",
    });
    const cars = getCars(db);
    expect(cars).toHaveLength(1);
    expect(cars[0].short).toBe("JF");
  });
});

describe("trips queries", () => {
  it("inserts a trip and computes km and amount", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "LEW",
      name: "Car LEW",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-18",
      start_odometer: 233900,
      end_odometer: 241929,
      location: null,
    });
    const trips = getTrips(db);
    expect(trips[0].km).toBe(8029);
    expect(trips[0].amount).toBeCloseTo(2007.25);
  });
});

describe("getLastCarState", () => {
  it("returns null when the car has no trips or fill-ups", () => {
    const db = makeDb();
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    expect(getLastCarState(db, cid)).toBeNull();
  });

  it("returns the last trip's end_odometer when trips exist", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "P" });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-01",
      start_odometer: 100,
      end_odometer: 150,
      location: "51.0,4.4",
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-10",
      start_odometer: 150,
      end_odometer: 200,
      location: "51.1,4.5",
    });
    expect(getLastCarState(db, cid)).toEqual({
      odometer: 200,
      location: "51.1,4.5",
      source: "trip",
    });
  });

  it("prefers a later fuel fill-up over an earlier trip", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "P" });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-01",
      start_odometer: 100,
      end_odometer: 150,
      location: null,
    });
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-05",
      amount: 50,
      liters: 30,
      odometer: 180,
      receipt: null,
      location: "station",
    });
    expect(getLastCarState(db, cid)).toEqual({
      odometer: 180,
      location: "station",
      source: "fuel",
    });
  });

  it("ignores fuel fill-ups where odometer is null", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "P" });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-01",
      start_odometer: 100,
      end_odometer: 150,
      location: "loc-trip",
    });
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-05",
      amount: 50,
      liters: 30,
      odometer: null,
      receipt: null,
      location: "loc-fuel",
    });
    expect(getLastCarState(db, cid)).toEqual({
      odometer: 150,
      location: "loc-trip",
      source: "trip",
    });
  });

  it("prefers trip over fuel when both share the same date", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "P" });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-10",
      amount: 50,
      liters: 30,
      odometer: 175,
      receipt: null,
      location: "station",
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-10",
      start_odometer: 175,
      end_odometer: 225,
      location: "parked",
    });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 225, location: "parked", source: "trip" });
  });
});

describe("getDashboard", () => {
  it("returns zero balance for person with no activity", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, first_name: "Test" });
    const rows = getDashboard(db, 2026);
    expect(rows[0].balance).toBe(0);
    expect(rows[0].trip_count).toBe(0);
  });

  it("computes negative balance when trip amount exceeds payments", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "LEW",
      name: "Car LEW",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const rows = getDashboard(db, 2026);
    expect(rows[0].balance).toBeCloseTo(-25);
    expect(rows[0].trip_km).toBe(100);
    expect(rows[0].trip_count).toBe(1);
  });

  it("filters trips outside target year", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "X" });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2025-06-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const rows = getDashboard(db, 2026);
    expect(rows[0].trip_count).toBe(0);
    expect(rows[0].balance).toBe(0);
  });

  it("includes payments in balance calculation", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Y" });
    const cid = insertCar(db, {
      short: "B",
      name: "B",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-03-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    // trip_amount = -25; pay back 10 → balance should be -15
    // calcPaymentYear("2027-03-15") = 2026, so this payment is attributed to year 2026
    insertPayment(db, { person_id: pid, amount: 10, date: "2027-03-15", note: null });
    const rows = getDashboard(db, 2026);
    expect(rows[0].paid_amount).toBeCloseTo(10);
    expect(rows[0].balance).toBeCloseTo(-15);
  });

  it("counts expenses in expense_count", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Z" });
    const cid = insertCar(db, {
      short: "C",
      name: "C",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertExpense(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-02-01",
      amount: 30,
      description: "oil",
      category: null,
    });
    insertExpense(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-03-01",
      amount: 15,
      description: "wash",
      category: null,
    });
    const rows = getDashboard(db, 2026);
    expect(rows[0].expense_count).toBe(2);
  });

  it("populates fuel_settled_* on own-car others breakdown", () => {
    const db = makeDb();
    const ownerId = insertPerson(db, { ...basePerson, first_name: "Owner A" });
    const memberId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "JF",
      name: "Car JF",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    db.prepare("UPDATE cars SET owner_person_id = ? WHERE id = ?").run(ownerId, cid);

    insertFuelFillup(db, {
      person_id: memberId,
      car_id: cid,
      date: "2026-01-10",
      amount: 40,
      liters: 25,
      full_tank: 0,
      odometer: null,
      receipt: null,
      location: null,
      gps_coords: null,
      settled_outside: 1,
    });
    insertFuelFillup(db, {
      person_id: memberId,
      car_id: cid,
      date: "2026-01-11",
      amount: 20,
      liters: 12,
      full_tank: 0,
      odometer: null,
      receipt: null,
      location: null,
      gps_coords: null,
      settled_outside: 0,
    });

    const rows = getDashboard(db, 2026);
    const ownerRow = rows.find((r) => r.person_id === ownerId)!;
    const ownCarBd = ownerRow.car_breakdowns.find((b) => b.is_own_car)!;
    expect(ownCarBd.fuel_settled_count).toBe(1);
    expect(ownCarBd.fuel_settled_liters).toBeCloseTo(25);
    expect(ownCarBd.expense_settled_count).toBe(0);
    expect(ownCarBd.expense_settled_amount).toBeCloseTo(0);
  });

  it("populates fuel_settled_* on cross-car breakdown", () => {
    const db = makeDb();
    const ownerId = insertPerson(db, { ...basePerson, first_name: "Owner A" });
    const owner2Id = insertPerson(db, { ...basePerson, first_name: "Owner B" });
    const cid = insertCar(db, {
      short: "JF",
      name: "Car JF",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    const cid2 = insertCar(db, {
      short: "LW",
      name: "Car LW",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    db.prepare("UPDATE cars SET owner_person_id = ? WHERE id = ?").run(ownerId, cid);
    db.prepare("UPDATE cars SET owner_person_id = ? WHERE id = ?").run(owner2Id, cid2);

    insertTrip(db, {
      person_id: ownerId,
      car_id: cid2,
      date: "2026-02-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    insertFuelFillup(db, {
      person_id: ownerId,
      car_id: cid2,
      date: "2026-02-01",
      amount: 50,
      liters: 30,
      full_tank: 0,
      odometer: null,
      receipt: null,
      location: null,
      gps_coords: null,
      settled_outside: 1,
    });

    const rows = getDashboard(db, 2026);
    const ownerARow = rows.find((r) => r.person_id === ownerId)!;
    const crossBd = ownerARow.car_breakdowns.find((b) => !b.is_own_car && b.car_short === "LW")!;
    expect(crossBd.fuel_settled_count).toBe(1);
    expect(crossBd.fuel_settled_liters).toBeCloseTo(30);
  });

  it("excludes settled_outside=1 fuel from fuel_amount and balance", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "JF",
      name: "Car JF",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    // settled_outside=1: should be excluded
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      amount: 50,
      liters: 30,
      full_tank: 0,
      odometer: null,
      receipt: null,
      location: null,
      gps_coords: null,
      settled_outside: 1,
    });
    // settled_outside=0: should be included
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      amount: 20,
      liters: 12,
      full_tank: 0,
      odometer: null,
      receipt: null,
      location: null,
      gps_coords: null,
      settled_outside: 0,
    });
    // trip_amount = -25 (100km * 0.25), fuel_amount should = 20 (not 70)
    // total_amount = -25 + 20 = -5, balance = -5
    const rows = getDashboard(db, 2026);
    expect(rows[0].fuel_amount).toBeCloseTo(20);
    expect(rows[0].fuel_count).toBe(1);
    expect(rows[0].total_amount).toBeCloseTo(-5);
    expect(rows[0].balance).toBeCloseTo(-5);
  });

  it("excludes settled_outside=1 expenses from expense_amount and balance", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Bob" });
    const cid = insertCar(db, {
      short: "LW",
      name: "Car LW",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-02-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    // settled_outside=1: should be excluded
    insertExpense(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-02-01",
      amount: 80,
      description: "big repair",
      category: null,
      settled_outside: 1,
    });
    // settled_outside=0: should be included
    insertExpense(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-02-01",
      amount: 30,
      description: "oil",
      category: null,
      settled_outside: 0,
    });
    // trip_amount = -25, expense_amount should = 30 (not 110)
    // total_amount = -25 + 30 = 5, balance = 5
    const rows = getDashboard(db, 2026);
    expect(rows[0].expense_amount).toBeCloseTo(30);
    expect(rows[0].expense_count).toBe(1);
    expect(rows[0].total_amount).toBeCloseTo(5);
    expect(rows[0].balance).toBeCloseTo(5);
  });
});
