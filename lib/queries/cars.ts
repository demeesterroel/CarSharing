import type Database from "better-sqlite3";
import type { Car, CarInput } from "@/types";

export function getCars(db: Database.Database): Car[] {
  return db.prepare("SELECT * FROM cars ORDER BY short").all() as Car[];
}

export function getCarById(db: Database.Database, id: number): Car | null {
  return (db.prepare("SELECT * FROM cars WHERE id=?").get(id) as Car) ?? null;
}

function recordPriceHistory(db: Database.Database, carId: number, price: number) {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO car_price_history (car_id, price_per_km, effective_from) VALUES (?,?,?)")
    .run(carId, price, today);
}

export function insertCar(db: Database.Database, data: CarInput): number {
  const result = db
    .prepare("INSERT INTO cars (short,name,price_per_km,brand,color,owner_name,long_threshold,fixed_costs_json) VALUES (?,?,?,?,?,?,?,?)")
    .run(
      data.short, data.name, data.price_per_km, data.brand ?? null, data.color ?? null,
      data.owner_name ?? null, data.long_threshold ?? 500, data.fixed_costs_json ?? null,
    );
  const newId = result.lastInsertRowid as number;
  recordPriceHistory(db, newId, data.price_per_km);
  return newId;
}

export function updateCar(db: Database.Database, id: number, data: CarInput): void {
  const current = getCarById(db, id);
  if (current && Math.abs(data.price_per_km - current.price_per_km) >= 0.0001) {
    recordPriceHistory(db, id, data.price_per_km);
  }
  db.prepare("UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=?,owner_name=?,long_threshold=?,fixed_costs_json=?,active=?,expected_km=? WHERE id=?")
    .run(
      data.short, data.name, data.price_per_km, data.brand ?? null, data.color ?? null,
      data.owner_name ?? null, data.long_threshold ?? 500, data.fixed_costs_json ?? null,
      data.active ?? 1, data.expected_km ?? null, id,
    );
}
