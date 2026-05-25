import type Database from "better-sqlite3";
import type { Trip, TripInput } from "@/types";
import { calcTripAmount } from "@/lib/formulas";

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export function getTrips(db: Database.Database): Trip[] {
  return db
    .prepare(
      `
    SELECT t.*, p.first_name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    ORDER BY t.date DESC, t.id DESC
  `
    )
    .all() as Trip[];
}

export function getTripById(db: Database.Database, id: number): Trip | null {
  return (
    (db
      .prepare(
        `
    SELECT t.*, p.first_name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    WHERE t.id = ?
  `
      )
      .get(id) as Trip) ?? null
  );
}

function compute(db: Database.Database, input: TripInput) {
  const person = db
    .prepare("SELECT discount, discount_long FROM people WHERE id=?")
    .get(input.person_id) as { discount: number; discount_long: number } | undefined;
  const car = db.prepare("SELECT price_per_km FROM cars WHERE id=?").get(input.car_id) as
    | { price_per_km: number }
    | undefined;
  if (!person || !car) throw new Error("Invalid person_id or car_id");
  const km = input.end_odometer - input.start_odometer;
  const amount = calcTripAmount(km, car.price_per_km, person.discount, person.discount_long);
  return { km, amount };
}

export function insertTrip(db: Database.Database, input: TripInput): number {
  // Idempotency: if a client_id is provided and already exists, return that row's id.
  if (input.client_id) {
    const existing = db.prepare("SELECT id FROM trips WHERE client_id = ?").get(input.client_id) as
      | { id: number }
      | undefined;
    if (existing) return existing.id;
  }
  const { km, amount } = compute(db, input);
  const result = db
    .prepare(
      `
    INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,location,parking,gps_coords,client_id,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
  `
    )
    .run(
      input.person_id,
      input.car_id,
      input.date,
      input.start_odometer,
      input.end_odometer,
      km,
      amount,
      input.location ?? null,
      input.parking ?? null,
      input.gps_coords ?? null,
      input.client_id ?? null
    );
  return result.lastInsertRowid as number;
}

export function updateTrip(
  db: Database.Database,
  id: number,
  input: TripInput,
  opts?: { expectedUpdatedAt?: string }
): void {
  if (opts?.expectedUpdatedAt) {
    const cur = db.prepare("SELECT updated_at FROM trips WHERE id = ?").get(id) as
      | { updated_at: string }
      | undefined;
    if (!cur) throw new ConflictError("Trip no longer exists");
    if (cur.updated_at !== opts.expectedUpdatedAt) {
      throw new ConflictError("Trip was modified after this offline edit");
    }
  }
  const { km, amount } = compute(db, input);
  db.prepare(
    `
    UPDATE trips SET person_id=?,car_id=?,date=?,start_odometer=?,end_odometer=?,km=?,amount=?,location=?,parking=?,gps_coords=? WHERE id=?
  `
  ).run(
    input.person_id,
    input.car_id,
    input.date,
    input.start_odometer,
    input.end_odometer,
    km,
    amount,
    input.location ?? null,
    input.parking ?? null,
    input.gps_coords ?? null,
    id
  );
}

export function deleteTrip(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM trips WHERE id=?").run(id);
}
