// lib/__tests__/queries_trips.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import { insertCar } from "../queries/cars";
import { insertPerson } from "../queries/people";
import {
  ConflictError,
  deleteTrip,
  getTripById,
  getTrips,
  insertTrip,
  updateTrip,
} from "../queries/trips";

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

describe("getTripById", () => {
  it("returns the correct trip with joined fields", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const tid = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const trip = getTripById(db, tid);
    expect(trip?.id).toBe(tid);
    expect(trip?.person_name).toBe("Alice");
    expect(trip?.car_short).toBe("CA");
    expect(trip?.km).toBe(100);
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    expect(getTripById(db, 9999)).toBeNull();
  });
});

describe("updateTrip", () => {
  it("with expectedUpdatedAt: succeeds when timestamp matches", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const tid = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const trip = getTripById(db, tid)!;
    expect(() =>
      updateTrip(
        db,
        tid,
        {
          person_id: pid,
          car_id: cid,
          date: "2026-05-01",
          start_odometer: 0,
          end_odometer: 200,
          location: null,
        },
        { expectedUpdatedAt: trip.updated_at }
      )
    ).not.toThrow();
    expect(getTripById(db, tid)?.km).toBe(200);
  });

  it("with expectedUpdatedAt: throws ConflictError when timestamp mismatches", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const tid = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    expect(() =>
      updateTrip(
        db,
        tid,
        {
          person_id: pid,
          car_id: cid,
          date: "2026-05-01",
          start_odometer: 0,
          end_odometer: 200,
          location: null,
        },
        { expectedUpdatedAt: "1999-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });

  it("with expectedUpdatedAt: throws ConflictError when trip no longer exists", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    expect(() =>
      updateTrip(
        db,
        9999,
        {
          person_id: pid,
          car_id: cid,
          date: "2026-05-01",
          start_odometer: 0,
          end_odometer: 100,
          location: null,
        },
        { expectedUpdatedAt: "2026-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });

  it("throws when invalid person_id or car_id", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const tid = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    expect(() =>
      updateTrip(db, tid, {
        person_id: 9999,
        car_id: cid,
        date: "2026-05-01",
        start_odometer: 0,
        end_odometer: 100,
        location: null,
      })
    ).toThrow("Invalid person_id or car_id");
  });
});

describe("getTrips sort order", () => {
  it("returns trips ordered by car then start_odometer ascending", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const carA = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const carB = insertCar(db, {
      short: "CB",
      name: "Car B",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });

    // Insert out of odometer order
    insertTrip(db, {
      person_id: pid,
      car_id: carA,
      date: "2026-05-03",
      start_odometer: 200,
      end_odometer: 300,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: carA,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: carB,
      date: "2026-05-02",
      start_odometer: 50,
      end_odometer: 150,
      location: null,
    });

    const trips = getTrips(db);
    const a = trips.filter((t) => t.car_id === carA);
    const b = trips.filter((t) => t.car_id === carB);

    expect(a[0].start_odometer).toBe(200);
    expect(a[1].start_odometer).toBe(0);
    expect(a[0].start_odometer).toBeGreaterThanOrEqual(a[1].end_odometer);
    expect(b).toHaveLength(1);
  });
});

describe("deleteTrip", () => {
  it("removes the trip from the DB", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    const tid = insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    deleteTrip(db, tid);
    expect(getTripById(db, tid)).toBeNull();
  });

  it("does not throw for non-existent id", () => {
    const db = makeDb();
    expect(() => deleteTrip(db, 9999)).not.toThrow();
  });
});
