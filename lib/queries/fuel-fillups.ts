import type Database from "better-sqlite3";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { calcPricePerLiter } from "@/lib/formulas";

export function getFuelFillups(db: Database.Database): FuelFillup[] {
  return db.prepare(`
    SELECT f.*, p.name AS person_name, c.short AS car_short
    FROM fuel_fillups f
    JOIN people p ON p.id = f.person_id
    JOIN cars c ON c.id = f.car_id
    ORDER BY f.date DESC, f.id DESC
  `).all() as FuelFillup[];
}

export function getFuelFillupById(db: Database.Database, id: number): FuelFillup | null {
  return (db.prepare(`
    SELECT f.*, p.name AS person_name, c.short AS car_short
    FROM fuel_fillups f
    JOIN people p ON p.id = f.person_id
    JOIN cars c ON c.id = f.car_id
    WHERE f.id = ?
  `).get(id) as FuelFillup) ?? null;
}

export function insertFuelFillup(db: Database.Database, input: FuelFillupInput): number {
  const price_per_liter = calcPricePerLiter(input.amount, input.liters);
  const result = db.prepare(`
    INSERT INTO fuel_fillups (person_id,car_id,date,amount,liters,price_per_liter,full_tank,odometer,receipt,location,gps_coords)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.amount, input.liters, price_per_liter,
    input.full_tank ?? 0,
    input.odometer ?? null, input.receipt ?? null,
    input.location ?? null, input.gps_coords ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateFuelFillup(db: Database.Database, id: number, input: FuelFillupInput): void {
  const price_per_liter = calcPricePerLiter(input.amount, input.liters);
  db.prepare(`
    UPDATE fuel_fillups
    SET person_id=?,car_id=?,date=?,amount=?,liters=?,price_per_liter=?,full_tank=?,odometer=?,receipt=?,location=?,gps_coords=?
    WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date,
    input.amount, input.liters, price_per_liter,
    input.full_tank ?? 0,
    input.odometer ?? null, input.receipt ?? null,
    input.location ?? null, input.gps_coords ?? null, id
  );
}

export function deleteFuelFillup(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM fuel_fillups WHERE id=?").run(id);
}
