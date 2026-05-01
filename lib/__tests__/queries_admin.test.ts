// lib/__tests__/queries_admin.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { insertPerson } from "../queries/people";
import { insertCar } from "../queries/cars";
import { insertTrip } from "../queries/trips";
import { insertFuelFillup } from "../queries/fuel-fillups";
import { insertExpense } from "../queries/expenses";
import {
  getCarPnL,
  getMonthlyCarKm,
  getPersonContributions,
  getHistoricalCarKm,
  getPriceHistory,
  getZeroKmTrips,
  getKmGaps,
} from "../queries/admin";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = {
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
};

describe("getCarPnL", () => {
  it("returns empty array when no cars exist", () => {
    const db = makeDb();
    expect(getCarPnL(db, 2026)).toEqual([]);
  });

  it("returns a car with zero aggregates when no trips/fuel/expenses", () => {
    const db = makeDb();
    insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.2, brand: null, color: null });
    const pnl = getCarPnL(db, 2026);
    expect(pnl).toHaveLength(1);
    expect(pnl[0].car_short).toBe("CA");
    expect(pnl[0].trip_count).toBe(0);
    expect(pnl[0].trip_km).toBe(0);
    expect(pnl[0].cost_per_km).toBe(0);
  });

  it("aggregates trips, fuel and expenses for the correct year", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
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
    insertFuelFillup(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-01",
      amount: 60,
      liters: 40,
      odometer: null,
      receipt: null,
      location: null,
    });
    insertExpense(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-05-01",
      amount: 30,
      description: "Oil",
    });
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].trip_count).toBe(1);
    expect(pnl[0].trip_km).toBe(100);
    expect(pnl[0].fuel_count).toBe(1);
    expect(pnl[0].fuel_amount).toBe(60);
    expect(pnl[0].expense_count).toBe(1);
    expect(pnl[0].expense_amount).toBe(30);
    expect(pnl[0].variable_total).toBe(90);
    expect(pnl[0].total_cost).toBe(90);
    expect(pnl[0].cost_per_km).toBeCloseTo(0.9);
  });

  it("does not include activities from other years", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2025-03-01",
      start_odometer: 0,
      end_odometer: 200,
      location: null,
    });
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].trip_count).toBe(0);
  });

  it("parses fixed_costs_json (array format)", () => {
    const db = makeDb();
    const fixedCosts = JSON.stringify([
      { id: "f1", category: "verzekeringen", description: "Insurance", amount: 500 },
      { id: "f2", category: "belastingen", description: "Tax", amount: 200 },
    ]);
    insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
      fixed_costs_json: fixedCosts,
    });
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].fixed_costs).toHaveLength(2);
    expect(pnl[0].fixed_total).toBe(700);
  });

  it("handles legacy fixed_costs_json format", () => {
    const db = makeDb();
    const legacyCosts = JSON.stringify({
      verzekering: 300,
      belasting: 150,
      keuring: 100,
      afschrijving: 0,
    });
    insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
      fixed_costs_json: legacyCosts,
    });
    const pnl = getCarPnL(db, 2026);
    // Entries with value > 0 only: verzekering(300) + belasting(150) + keuring(100) = 3 items
    expect(pnl[0].fixed_costs.length).toBeGreaterThanOrEqual(3);
    expect(pnl[0].fixed_total).toBe(550);
  });

  it("handles invalid fixed_costs_json gracefully", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO cars (short,name,price_per_km,fixed_costs_json) VALUES ('CA','Car A',0.2,'not-json')`
    );
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].fixed_costs).toEqual([]);
    expect(pnl[0].fixed_total).toBe(0);
  });

  it("computes owner_trip_amount for owner's own car trips", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
      owner_name: "Alice",
    });
    const cid = (db.prepare("SELECT id FROM cars WHERE short='CA'").get() as any).id;
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].owner_trip_amount).toBeGreaterThan(0);
  });

  it("includes previous year km in prev_year_trip_km", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2025-06-01",
      start_odometer: 0,
      end_odometer: 300,
      location: null,
    });
    const pnl = getCarPnL(db, 2026);
    expect(pnl[0].prev_year_trip_km).toBe(300);
  });
});

describe("getMonthlyCarKm", () => {
  it("returns empty array when no trips for a year with no activity", () => {
    const db = makeDb();
    // 2020 has no trips in the migration data — safe year to use
    expect(getMonthlyCarKm(db, 2020)).toEqual([]);
  });

  it("returns monthly km per car for the inserted car only", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
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
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-03-15",
      start_odometer: 100,
      end_odometer: 200,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-04-01",
      start_odometer: 200,
      end_odometer: 350,
      location: null,
    });
    const monthly = getMonthlyCarKm(db, 2026);
    // Filter to only the car we inserted (migration data may include other car_ids)
    const ourMonthly = monthly.filter((m) => m.car_id === cid);
    expect(ourMonthly).toHaveLength(2);
    const march = ourMonthly.find((m) => m.year_month === "2026-03");
    const april = ourMonthly.find((m) => m.year_month === "2026-04");
    expect(march?.km).toBe(200);
    expect(april?.km).toBe(150);
  });
});

describe("getPersonContributions", () => {
  it("returns empty array when no trips", () => {
    const db = makeDb();
    expect(getPersonContributions(db, 2026)).toEqual([]);
  });

  it("returns contributions per person per car", () => {
    const db = makeDb();
    const pid1 = insertPerson(db, { ...basePerson, name: "Alice" });
    const pid2 = insertPerson(db, { ...basePerson, name: "Bob" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid1,
      car_id: cid,
      date: "2026-03-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    insertTrip(db, {
      person_id: pid2,
      car_id: cid,
      date: "2026-03-02",
      start_odometer: 100,
      end_odometer: 250,
      location: null,
    });
    const contribs = getPersonContributions(db, 2026);
    expect(contribs).toHaveLength(2);
    const bob = contribs.find((c) => c.person_name === "Bob");
    expect(bob?.km).toBe(150);
  });
});

describe("getHistoricalCarKm", () => {
  it("returns empty array when no trips in the 6-year window (far future year)", () => {
    const db = makeDb();
    // 2060: migration data (2022, 2023, 2026) falls outside the window 2054-2059
    expect(getHistoricalCarKm(db, 2060)).toEqual([]);
  });

  it("returns km grouped by car and year for past 6 years", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2022-06-01",
      start_odometer: 0,
      end_odometer: 500,
      location: null,
    });
    const hist = getHistoricalCarKm(db, 2026);
    // Filter to the car we inserted; migration data may have other entries for car_id=2
    const ourHist = hist.filter((h) => h.car_id === cid);
    expect(ourHist.some((h) => h.year === 2022 && h.km === 500)).toBe(true);
  });
});

describe("getPriceHistory", () => {
  it("returns empty array when no cars", () => {
    const db = makeDb();
    expect(getPriceHistory(db)).toEqual([]);
  });

  it("returns price history entries from car inserts", () => {
    const db = makeDb();
    insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.25, brand: null, color: null });
    const history = getPriceHistory(db);
    expect(history).toHaveLength(1);
    expect(history[0].price_per_km).toBe(0.25);
  });
});

describe("getZeroKmTrips", () => {
  it("returns empty array when no zero-km trips", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    expect(getZeroKmTrips(db)).toEqual([]);
  });

  it("returns trips where km=0", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    // Insert a trip with start == end (0 km)
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 100,
      end_odometer: 100,
      location: null,
    });
    const zeros = getZeroKmTrips(db);
    expect(zeros).toHaveLength(1);
    expect(zeros[0].car_short).toBe("CA");
    expect(zeros[0].person_name).toBe("Alice");
  });
});

describe("getKmGaps", () => {
  it("returns empty array when no cars", () => {
    const db = makeDb();
    expect(getKmGaps(db)).toEqual([]);
  });

  it("returns empty array when trips are contiguous", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-02",
      start_odometer: 100,
      end_odometer: 200,
      location: null,
    });
    expect(getKmGaps(db)).toHaveLength(0);
  });

  it("detects gaps between non-contiguous trips", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      start_odometer: 150,
      end_odometer: 200,
      location: null,
    });
    const gaps = getKmGaps(db);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].car_short).toBe("CA");
    expect(gaps[0].missing_km).toBe(50);
  });

  it("does not flag a gap when difference is <=1 km", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, {
      short: "CA",
      name: "Car A",
      price_per_km: 0.2,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    // start_odometer exactly 1 more than end_odometer of previous — boundary case
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      start_odometer: 101,
      end_odometer: 200,
      location: null,
    });
    expect(getKmGaps(db)).toHaveLength(0);
  });
});
