import type { Car, CarInput } from "@/types";
import type Database from "better-sqlite3";

export function getCars(db: Database.Database): Car[] {
  return db.prepare("SELECT * FROM cars ORDER BY short").all() as Car[];
}

export function getCarById(db: Database.Database, id: number): Car | null {
  return (db.prepare("SELECT * FROM cars WHERE id=?").get(id) as Car) ?? null;
}

export interface CarStats {
  tripCount: number;
  totalKm: number;
  totalFuelLiters: number;
  totalFuelCost: number;
  avgConsumptionLper100km: number | null;
  avgFuelCostPerKm: number | null;
}

function recordPriceHistory(db: Database.Database, carId: number, price: number) {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    "INSERT INTO car_price_history (car_id, price_per_km, effective_from) VALUES (?,?,?)"
  ).run(carId, price, today);
}

export function insertCar(db: Database.Database, data: CarInput): number {
  return db.transaction((d: CarInput) => {
    const result = db
      .prepare(
        "INSERT INTO cars (short,name,price_per_km,brand,color,long_threshold,owner_person_id) VALUES (?,?,?,?,?,?,?)"
      )
      .run(
        d.short,
        d.name,
        d.price_per_km,
        d.brand ?? null,
        d.color ?? null,
        d.long_threshold ?? 500,
        d.owner_person_id ?? null
      );
    const newId = result.lastInsertRowid as number;
    recordPriceHistory(db, newId, d.price_per_km);
    return newId;
  })(data);
}

export function updateCar(db: Database.Database, id: number, data: CarInput): void {
  db.transaction((args: { id: number; data: CarInput }) => {
    const current = getCarById(db, args.id);
    if (current && Math.abs(args.data.price_per_km - current.price_per_km) >= 0.0001) {
      recordPriceHistory(db, args.id, args.data.price_per_km);
    }
    db.prepare(
      "UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=?,long_threshold=?,active=?,expected_km=?,owner_person_id=? WHERE id=?"
    ).run(
      args.data.short,
      args.data.name,
      args.data.price_per_km,
      args.data.brand ?? null,
      args.data.color ?? null,
      args.data.long_threshold ?? 500,
      args.data.active ?? 1,
      args.data.expected_km ?? null,
      args.data.owner_person_id ?? null,
      args.id
    );
  })({ id, data });
}

export function getCarStats(db: Database.Database, carId: number, year: number): CarStats {
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Count trips and sum kilometers
  const tripRow = db.prepare(`
    SELECT 
      COUNT(*) as tripCount,
      SUM(km) as totalKm
    FROM trips 
    WHERE car_id = ? AND date BETWEEN ? AND ?
  `).get(carId, startOfYear, endOfYear) as { tripCount: number; totalKm: number } | null;

  // Sum fuel fillups
  const fuelRow = db.prepare(`
    SELECT 
      SUM(liters) as totalFuelLiters,
      SUM(amount) as totalFuelCost
    FROM fuel_fillups 
    WHERE car_id = ? AND date BETWEEN ? AND ?
  `).get(carId, startOfYear, endOfYear) as { totalFuelLiters: number; totalFuelCost: number } | null;

  const tripCount = tripRow?.tripCount ?? 0;
  const totalKm = tripRow?.totalKm ?? 0;
  const totalFuelLiters = fuelRow?.totalFuelLiters ?? 0;
  const totalFuelCost = fuelRow?.totalFuelCost ?? 0;

  const avgConsumptionLper100km = totalKm > 0 ? (totalFuelLiters / totalKm) * 100 : null;
  const avgFuelCostPerKm = totalKm > 0 ? totalFuelCost / totalKm : null;

  return {
    tripCount,
    totalKm,
    totalFuelLiters,
    totalFuelCost,
    avgConsumptionLper100km,
    avgFuelCostPerKm,
  };
}

export function carHasHistory(db: Database.Database, id: number): boolean {
  const tripRow = db.prepare("SELECT 1 FROM trips WHERE car_id = ? LIMIT 1").get(id);
  if (tripRow !== undefined) return true;

  const fuelRow = db.prepare("SELECT 1 FROM fuel_fillups WHERE car_id = ? LIMIT 1").get(id);
  if (fuelRow !== undefined) return true;

  const expenseRow = db.prepare("SELECT 1 FROM expenses WHERE car_id = ? LIMIT 1").get(id);
  if (expenseRow !== undefined) return true;

  const reservationRow = db.prepare("SELECT 1 FROM reservations WHERE car_id = ? LIMIT 1").get(id);
  return reservationRow !== undefined;
}

export function deleteCar(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM cars WHERE id = ?").run(id);
}
