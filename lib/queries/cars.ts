import type Database from "better-sqlite3";
import type { Car } from "@/types";

export function getCars(db: Database.Database): Car[] {
  return db.prepare("SELECT * FROM cars ORDER BY short").all() as Car[];
}

export function getCarById(db: Database.Database, id: number): Car | null {
  return (db.prepare("SELECT * FROM cars WHERE id=?").get(id) as Car) ?? null;
}

export function insertCar(db: Database.Database, data: Omit<Car, "id">): number {
  const result = db
    .prepare("INSERT INTO cars (short,name,price_per_km,brand,color) VALUES (?,?,?,?,?)")
    .run(data.short, data.name, data.price_per_km, data.brand, data.color);
  return result.lastInsertRowid as number;
}

export function updateCar(db: Database.Database, id: number, data: Omit<Car, "id">): void {
  db.prepare("UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=? WHERE id=?")
    .run(data.short, data.name, data.price_per_km, data.brand, data.color, id);
}
