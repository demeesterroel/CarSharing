import type Database from "better-sqlite3";
import type { Payment, PaymentInput } from "@/types";
import { calcPaymentYear } from "@/lib/formulas";

export function getPayments(db: Database.Database): Payment[] {
  return db.prepare(`
    SELECT b.*, p.name AS person_name
    FROM payments b
    JOIN people p ON p.id = b.person_id
    ORDER BY b.date DESC, b.id DESC
  `).all() as Payment[];
}

export function getPaymentById(db: Database.Database, id: number): Payment | null {
  return (db.prepare(`
    SELECT b.*, p.name AS person_name FROM payments b
    JOIN people p ON p.id = b.person_id WHERE b.id=?
  `).get(id) as Payment) ?? null;
}

export function insertPayment(db: Database.Database, input: PaymentInput): number {
  const year = calcPaymentYear(input.date);
  const result = db.prepare(
    "INSERT INTO payments (person_id,date,amount,note,year) VALUES (?,?,?,?,?)"
  ).run(input.person_id, input.date, input.amount, input.note ?? null, year);
  return result.lastInsertRowid as number;
}

export function updatePayment(db: Database.Database, id: number, input: PaymentInput): void {
  const year = calcPaymentYear(input.date);
  db.prepare("UPDATE payments SET person_id=?,date=?,amount=?,note=?,year=? WHERE id=?")
    .run(input.person_id, input.date, input.amount, input.note ?? null, year, id);
}

export function deletePayment(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM payments WHERE id=?").run(id);
}
