import type Database from "better-sqlite3";
import type { Reservation, ReservationInput } from "@/types";

export function getReservations(db: Database.Database): Reservation[] {
  return db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM reservations r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    ORDER BY r.start_date DESC
  `).all() as Reservation[];
}

export function getReservationById(db: Database.Database, id: number): Reservation | null {
  return (db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM reservations r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = ?
  `).get(id) as Reservation) ?? null;
}

export function insertReservation(db: Database.Database, input: ReservationInput): number {
  const result = db.prepare(
    "INSERT INTO reservations (person_id,car_id,start_date,end_date) VALUES (?,?,?,?)"
  ).run(input.person_id, input.car_id, input.start_date, input.end_date);
  return result.lastInsertRowid as number;
}

export function updateReservation(db: Database.Database, id: number, input: ReservationInput): void {
  db.prepare("UPDATE reservations SET person_id=?,car_id=?,start_date=?,end_date=? WHERE id=?")
    .run(input.person_id, input.car_id, input.start_date, input.end_date, id);
}

export function deleteReservation(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM reservations WHERE id=?").run(id);
}
