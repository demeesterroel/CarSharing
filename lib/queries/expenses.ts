import type Database from "better-sqlite3";
import type { Expense, ExpenseInput } from "@/types";

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export function getExpenses(db: Database.Database): Expense[] {
  return db
    .prepare(
      `
    SELECT e.*, p.first_name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    ORDER BY e.date DESC, e.id DESC
  `
    )
    .all() as Expense[];
}

export function getExpenseById(db: Database.Database, id: number): Expense | null {
  return (
    (db
      .prepare(
        `
    SELECT e.*, p.first_name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    WHERE e.id = ?
  `
      )
      .get(id) as Expense) ?? null
  );
}

export function insertExpense(db: Database.Database, input: ExpenseInput): number {
  // Idempotency: if a client_id is provided and already exists, return that row's id.
  if (input.client_id) {
    const existing = db
      .prepare("SELECT id FROM expenses WHERE client_id = ?")
      .get(input.client_id) as { id: number } | undefined;
    if (existing) return existing.id;
  }
  const result = db
    .prepare(
      `
    INSERT INTO expenses (person_id,car_id,date,amount,description,category,settled_outside,client_id,updated_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `
    )
    .run(
      input.person_id,
      input.car_id,
      input.date,
      input.amount,
      input.description ?? null,
      input.category ?? null,
      input.settled_outside ?? 0,
      input.client_id ?? null
    );
  return result.lastInsertRowid as number;
}

export function updateExpense(
  db: Database.Database,
  id: number,
  input: ExpenseInput,
  opts?: { expectedUpdatedAt?: string }
): void {
  if (opts?.expectedUpdatedAt) {
    const cur = db.prepare("SELECT updated_at FROM expenses WHERE id = ?").get(id) as
      | { updated_at: string }
      | undefined;
    if (!cur) throw new ConflictError("Expense no longer exists");
    if (cur.updated_at !== opts.expectedUpdatedAt) {
      throw new ConflictError("Expense was modified after this offline edit");
    }
  }
  db.prepare(
    `
    UPDATE expenses SET person_id=?,car_id=?,date=?,amount=?,description=?,category=?,settled_outside=? WHERE id=?
  `
  ).run(
    input.person_id,
    input.car_id,
    input.date,
    input.amount,
    input.description ?? null,
    input.category ?? null,
    input.settled_outside ?? 0,
    id
  );
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM expenses WHERE id=?").run(id);
}
