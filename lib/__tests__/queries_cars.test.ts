// lib/__tests__/queries_cars.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import {
  carHasHistory,
  deleteCar,
  getCarById,
  getCars,
  getCarStats,
  insertCar,
  updateCar,
} from "../queries/cars";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const baseCar = {
  short: "CA",
  name: "Car A",
  price_per_km: 0.2,
  brand: "Toyota" as string | null,
  color: "red" as string | null,
};

describe("getCars", () => {
  it("returns empty array when no cars exist", () => {
    const db = makeDb();
    expect(getCars(db)).toEqual([]);
  });

  it("returns all cars ordered by short", () => {
    const db = makeDb();
    insertCar(db, { ...baseCar, short: "ZZ", name: "Zara" });
    insertCar(db, { ...baseCar, short: "AA", name: "Alpha" });
    const cars = getCars(db);
    expect(cars[0].short).toBe("AA");
    expect(cars[1].short).toBe("ZZ");
  });
});

describe("getCarById", () => {
  it("returns the correct car", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    const car = getCarById(db, id);
    expect(car?.id).toBe(id);
    expect(car?.short).toBe("CA");
    expect(car?.price_per_km).toBe(0.2);
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    expect(getCarById(db, 9999)).toBeNull();
  });
});

describe("insertCar", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("records price history on insert", () => {
    const db = makeDb();
    const id = insertCar(db, { ...baseCar, price_per_km: 0.3 });
    const history = db.prepare("SELECT * FROM car_price_history WHERE car_id=?").all(id) as any[];
    expect(history).toHaveLength(1);
    expect(history[0].price_per_km).toBe(0.3);
  });

  it("uses default long_threshold of 500 when not provided", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    const car = getCarById(db, id);
    expect(car?.long_threshold).toBe(500);
  });

  it("stores owner_person_id when provided", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, { ...baseCar, owner_person_id: 1 });
    const car = getCarById(db, id);
    expect(car?.owner_person_id).toBe(1);
  });

  it("stores null brand and color", () => {
    const db = makeDb();
    const id = insertCar(db, { ...baseCar, brand: null, color: null });
    const car = getCarById(db, id);
    expect(car?.brand).toBeNull();
    expect(car?.color).toBeNull();
  });
});

describe("updateCar", () => {
  it("updates car fields", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    updateCar(db, id, {
      ...baseCar,
      short: "CB",
      name: "Car B",
      price_per_km: 0.25,
      brand: "Ford",
      color: "blue",
    });
    const car = getCarById(db, id);
    expect(car?.short).toBe("CB");
    expect(car?.name).toBe("Car B");
    expect(car?.price_per_km).toBe(0.25);
    expect(car?.brand).toBe("Ford");
    expect(car?.color).toBe("blue");
  });

  it("records price history when price changes", () => {
    const db = makeDb();
    const id = insertCar(db, { ...baseCar, price_per_km: 0.2 });
    // Update with a different price
    updateCar(db, id, { ...baseCar, price_per_km: 0.35 });
    const history = db
      .prepare("SELECT * FROM car_price_history WHERE car_id=? ORDER BY id")
      .all(id) as any[];
    // One from insert, one from update
    expect(history).toHaveLength(2);
    expect(history[1].price_per_km).toBe(0.35);
  });

  it("does NOT record price history when price stays the same", () => {
    const db = makeDb();
    const id = insertCar(db, { ...baseCar, price_per_km: 0.2 });
    updateCar(db, id, { ...baseCar, price_per_km: 0.2 });
    const history = db.prepare("SELECT * FROM car_price_history WHERE car_id=?").all(id) as any[];
    // Only the initial insert entry
    expect(history).toHaveLength(1);
  });

  it("sets active flag", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    updateCar(db, id, { ...baseCar, active: 0 });
    const car = getCarById(db, id);
    expect(car?.active).toBe(0);
  });

  it("sets expected_km when provided", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    updateCar(db, id, { ...baseCar, expected_km: 15000 });
    const car = getCarById(db, id);
    expect(car?.expected_km).toBe(15000);
  });

  it("does nothing for non-existent id without throwing", () => {
    const db = makeDb();
    expect(() => updateCar(db, 9999, baseCar)).not.toThrow();
  });
});

describe("getCarStats", () => {
  it("returns zero stats for a car with no trips or fuel fillups", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    
    const stats = getCarStats(db, id, 2025);
    expect(stats.tripCount).toBe(0);
    expect(stats.totalKm).toBe(0);
    expect(stats.totalFuelLiters).toBe(0);
    expect(stats.totalFuelCost).toBe(0);
    expect(stats.avgConsumptionLper100km).toBeNull();
    expect(stats.avgFuelCostPerKm).toBeNull();
  });

  it("calculates stats correctly for a car with trips and fuel fillups", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    
    // Insert trips
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2025-01-01', 0, 100, 100, 20.0),
              (1, ${id}, '2025-01-02', 100, 250, 150, 30.0)`
    );
    
    // Insert fuel fillups
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-01", 50, 60, 1.2);
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-02", 40, 48, 1.2);
    
    const stats = getCarStats(db, id, 2025);
    expect(stats.tripCount).toBe(2);
    expect(stats.totalKm).toBe(250);
    expect(stats.totalFuelLiters).toBe(90);
    expect(stats.totalFuelCost).toBe(108);
    expect(stats.avgConsumptionLper100km).toBeCloseTo(36); // 90/250 * 100
    expect(stats.avgFuelCostPerKm).toBeCloseTo(0.432); // 108/250
  });

  it("filters trips and fuel fillups by year", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    
    // Insert trips and fuel fillups for 2024
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2024-01-01', 0, 100, 100, 20.0)`
    );
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2024-01-01", 50, 60, 1.2);
    
    // Insert trips and fuel fillups for 2025
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2025-01-01', 0, 150, 150, 30.0)`
    );
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-01", 40, 48, 1.2);
    
    // Test 2024 stats
    const stats2024 = getCarStats(db, id, 2024);
    expect(stats2024.tripCount).toBe(1);
    expect(stats2024.totalKm).toBe(100);
    expect(stats2024.totalFuelLiters).toBe(50);
    expect(stats2024.totalFuelCost).toBe(60);
    expect(stats2024.avgConsumptionLper100km).toBeCloseTo(50); // 50/100 * 100
    expect(stats2024.avgFuelCostPerKm).toBeCloseTo(0.6); // 60/100
    
    // Test 2025 stats
    const stats2025 = getCarStats(db, id, 2025);
    expect(stats2025.tripCount).toBe(1);
    expect(stats2025.totalKm).toBe(150);
    expect(stats2025.totalFuelLiters).toBe(40);
    expect(stats2025.totalFuelCost).toBe(48);
    expect(stats2025.avgConsumptionLper100km).toBeCloseTo(26.67); // 40/150 * 100
    expect(stats2025.avgFuelCostPerKm).toBeCloseTo(0.32); // 48/150
  });
});

describe("carHasHistory", () => {
  it("returns false for a fresh car with no trips, fuel, expenses, or reservations", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    expect(carHasHistory(db, id)).toBe(false);
  });

  it("returns true when the car has at least one trip", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2025-01-01', 0, 10, 10, 2.0)`
    );
    expect(carHasHistory(db, id)).toBe(true);
  });

  it("returns true when the car has at least one fuel fillup", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-01", 50, 60, 1.2);
    expect(carHasHistory(db, id)).toBe(true);
  });

  it("returns true when the car has at least one expense", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    db.prepare(
      "INSERT INTO expenses (person_id, car_id, date, amount, description, category) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-01", 150, "Maintenance", "repair");
    expect(carHasHistory(db, id)).toBe(true);
  });

  it("returns true when the car has at least one reservation", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    db.prepare(
      "INSERT INTO reservations (person_id, car_id, start_date, end_date, status, note) VALUES (?,?,?,?,?,?)"
    ).run(1, id, "2025-01-01", "2025-01-03", "pending", "Weekend trip");
    expect(carHasHistory(db, id)).toBe(true);
  });
});

describe("deleteCar", () => {
  it("removes the car from the database", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    expect(getCarById(db, id)).not.toBeNull();
    deleteCar(db, id);
    expect(getCarById(db, id)).toBeNull();
  });

  it("does not throw for a non-existent id", () => {
    const db = makeDb();
    expect(() => deleteCar(db, 9999)).not.toThrow();
  });

  it("throws a FK constraint error when the car has trips (foreign keys enabled)", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO people (id, first_name, last_name, active) VALUES (1, 'Alice', 'Owner', 1)`
    );
    const id = insertCar(db, baseCar);
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2025-01-01', 0, 10, 10, 2.0)`
    );
    expect(() => deleteCar(db, id)).toThrow();
  });
});
