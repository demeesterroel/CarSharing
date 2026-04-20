import type Database from "better-sqlite3";

export function insertFuelFillup(db: Database.Database, input: {
  person_id: number;
  car_id: number;
  date: string;
  amount: number;
  liters: number;
  price_per_liter?: number;
  odometer: number | null;
  receipt: string | null;
  location: string | null;
}): number {
  const result = db.prepare(`
    INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter, odometer, receipt, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.amount, input.liters,
    input.price_per_liter ?? (input.liters > 0 ? input.amount / input.liters : 0),
    input.odometer, input.receipt, input.location
  );
  return result.lastInsertRowid as number;
}
