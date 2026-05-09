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
  db.prepare(
    "INSERT INTO car_price_history (car_id, price_per_km, effective_from) VALUES (?,?,?)"
  ).run(carId, price, today);
}

export function insertCar(db: Database.Database, data: CarInput): number {
  return db.transaction((d: CarInput) => {
    const result = db
      .prepare(
        "INSERT INTO cars (short,name,price_per_km,brand,color,owner_name,long_threshold,owner_person_id) VALUES (?,?,?,?,?,?,?,?)"
      )
      .run(
        d.short,
        d.name,
        d.price_per_km,
        d.brand ?? null,
        d.color ?? null,
        d.owner_name ?? null,
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
    // Sync owner_name from person table when owner_person_id is set
    let ownerName = args.data.owner_name ?? null;
    if (args.data.owner_person_id) {
      const person = db
        .prepare("SELECT name FROM people WHERE id = ?")
        .get(args.data.owner_person_id) as { name: string } | undefined;
      if (person) ownerName = person.name.split(" ")[0];
    }
    db.prepare(
      "UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=?,owner_name=?,long_threshold=?,active=?,expected_km=?,owner_person_id=? WHERE id=?"
    ).run(
      args.data.short,
      args.data.name,
      args.data.price_per_km,
      args.data.brand ?? null,
      args.data.color ?? null,
      ownerName,
      args.data.long_threshold ?? 500,
      args.data.active ?? 1,
      args.data.expected_km ?? null,
      args.data.owner_person_id ?? null,
      args.id
    );
  })({ id, data });
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
