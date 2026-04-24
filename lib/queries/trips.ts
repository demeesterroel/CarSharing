import type Database from "better-sqlite3";
import type { Trip, TripInput } from "@/types";
import { calcTripAmount } from "@/lib/formulas";

export function getTrips(db: Database.Database): Trip[] {
  return db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    ORDER BY t.date DESC, t.id DESC
  `).all() as Trip[];
}

export function getTripById(db: Database.Database, id: number): Trip | null {
  return (db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    WHERE t.id = ?
  `).get(id) as Trip) ?? null;
}

function compute(db: Database.Database, input: TripInput) {
  const person = db.prepare("SELECT discount, discount_long FROM people WHERE id=?")
    .get(input.person_id) as { discount: number; discount_long: number } | undefined;
  const car = db.prepare("SELECT price_per_km FROM cars WHERE id=?")
    .get(input.car_id) as { price_per_km: number } | undefined;
  if (!person || !car) throw new Error("Invalid person_id or car_id");
  const km = input.end_odometer - input.start_odometer;
  const amount = calcTripAmount(km, car.price_per_km, person.discount, person.discount_long);
  return { km, amount };
}

export function insertTrip(db: Database.Database, input: TripInput): number {
  const { km, amount } = compute(db, input);
  const result = db.prepare(`
    INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,location,parking,gps_coords)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.start_odometer, input.end_odometer, km, amount,
    input.location ?? null, input.parking ?? null, input.gps_coords ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateTrip(db: Database.Database, id: number, input: TripInput): void {
  const { km, amount } = compute(db, input);
  db.prepare(`
    UPDATE trips SET person_id=?,car_id=?,date=?,start_odometer=?,end_odometer=?,km=?,amount=?,location=?,parking=?,gps_coords=? WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date,
    input.start_odometer, input.end_odometer, km, amount,
    input.location ?? null, input.parking ?? null, input.gps_coords ?? null, id
  );
}

export function deleteTrip(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM trips WHERE id=?").run(id);
}
