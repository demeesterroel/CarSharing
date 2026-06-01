import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { insertPerson } from "../queries/people";
import { insertCar } from "../queries/cars";
import { insertTrip } from "../queries/trips";
import { getDuplicateTrips } from "../queries/admin";

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

describe("getDuplicateTrips", () => {
  it("returns empty array when no trips exist", () => {
    const db = makeDb();
    expect(getDuplicateTrips(db)).toEqual([]);
  });

  it("returns empty array when trips share car+person but different odometer range", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "TT",
      name: "Test Car",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-01-01",
      start_odometer: 100,
      end_odometer: 200,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-01-02",
      start_odometer: 200,
      end_odometer: 300,
      location: null,
    });
    expect(getDuplicateTrips(db)).toEqual([]);
  });

  it("returns one pair when two trips have identical person, car, start, and end odometer", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "TT",
      name: "Test Car",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const t1 = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-03-01",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    const t2 = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-03-02",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });

    const pairs = getDuplicateTrips(db);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].trip1_id).toBe(t1);
    expect(pairs[0].trip2_id).toBe(t2);
    expect(pairs[0].person_name).toBe("Alice");
    expect(pairs[0].car_short).toBe("TT");
    expect(pairs[0].start_odometer).toBe(500);
    expect(pairs[0].end_odometer).toBe(600);
    expect(pairs[0].km).toBe(100);
    expect(pairs[0].date1).toBe("2024-03-01");
    expect(pairs[0].date2).toBe("2024-03-02");
  });

  it("does not return a pair for trips with the same odometer range but different person", () => {
    const db = makeDb();
    const p1 = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const p2 = insertPerson(db, { ...basePerson, first_name: "Bob" });
    const cid = insertCar(db, {
      short: "TT",
      name: "Test Car",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: p1,
      car_id: cid,
      date: "2024-03-01",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    insertTrip(db, {
      person_id: p2,
      car_id: cid,
      date: "2024-03-02",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    expect(getDuplicateTrips(db)).toEqual([]);
  });

  it("does not return a pair for trips with the same odometer range but different car", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const c1 = insertCar(db, {
      short: "AA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const c2 = insertCar(db, {
      short: "BB",
      name: "Car B",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: c1,
      date: "2024-03-01",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: c2,
      date: "2024-03-01",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    expect(getDuplicateTrips(db)).toEqual([]);
  });

  it("returns two pairs when three trips all share the same odometer range", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "TT",
      name: "Test Car",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-03-01",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-03-02",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2024-03-03",
      start_odometer: 500,
      end_odometer: 600,
      location: null,
    });
    expect(getDuplicateTrips(db)).toHaveLength(3);
  });
});
