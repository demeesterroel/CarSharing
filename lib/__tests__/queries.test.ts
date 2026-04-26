import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { getPeople, insertPerson, getPersonById } from "../queries/people";
import { getCars, insertCar } from "../queries/cars";
import { insertTrip, getTrips } from "../queries/trips";
import { getLastCarState } from "../queries/car-state";
import { insertFuelFillup } from "../queries/fuel-fillups";
import { getDashboard } from "../queries/dashboard";
import { insertPayment } from "../queries/payments";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = { discount: 0, discount_long: 0, active: 1 as const, username: null, password_hash: null, is_admin: 0 as const };

describe("people queries", () => {
  it("inserts and retrieves a person", () => {
    const db = makeDb();
    const id = insertPerson(db, { name: "Roeland", ...basePerson });
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

describe("trips queries", () => {
  it("inserts a trip and computes km and amount", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "Roeland", ...basePerson });
    const cid = insertCar(db, { short: "LEW", name: "Lewis", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-18", start_odometer: 233900, end_odometer: 241929, location: null });
    const trips = getTrips(db);
    expect(trips[0].km).toBe(8029);
    expect(trips[0].amount).toBeCloseTo(2007.25);
  });
});

describe("getLastCarState", () => {
  it("returns null when the car has no trips or fill-ups", () => {
    const db = makeDb();
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    expect(getLastCarState(db, cid)).toBeNull();
  });

  it("returns the last trip's end_odometer when trips exist", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", ...basePerson });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: "51.0,4.4" });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-10", start_odometer: 150, end_odometer: 200, location: "51.1,4.5" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 200, location: "51.1,4.5", source: "trip" });
  });

  it("prefers a later fuel fill-up over an earlier trip", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", ...basePerson });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: null });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-05", amount: 50, liters: 30, odometer: 180, receipt: null, location: "station" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 180, location: "station", source: "fuel" });
  });

  it("ignores fuel fill-ups where odometer is null", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", ...basePerson });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: "loc-trip" });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-05", amount: 50, liters: 30, odometer: null, receipt: null, location: "loc-fuel" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 150, location: "loc-trip", source: "trip" });
  });

  it("prefers trip over fuel when both share the same date", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", ...basePerson });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-10", amount: 50, liters: 30, odometer: 175, receipt: null, location: "station" });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-10", start_odometer: 175, end_odometer: 225, location: "parked" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 225, location: "parked", source: "trip" });
  });
});

describe("getDashboard", () => {
  it("returns zero balance for person with no activity", () => {
    const db = makeDb();
    insertPerson(db, { name: "Test", ...basePerson });
    const rows = getDashboard(db, 2026);
    expect(rows[0].balance).toBe(0);
    expect(rows[0].trip_count).toBe(0);
  });

  it("computes negative balance when trip amount exceeds payments", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "Roeland", ...basePerson });
    const cid = insertCar(db, {
      short: "LEW",
      name: "Lewis",
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
    const pid = insertPerson(db, { name: "X", ...basePerson });
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
    const pid = insertPerson(db, { name: "Y", ...basePerson });
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
});
