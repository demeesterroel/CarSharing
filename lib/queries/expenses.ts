import type Database from "better-sqlite3";
import type { Expense, ExpenseInput } from "@/types";

export function getExpenses(db: Database.Database): Expense[] {
  return db.prepare(`
    SELECT e.*, p.name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    ORDER BY e.date DESC, e.id DESC
  `).all() as Expense[];
}

export function getExpenseById(db: Database.Database, id: number): Expense | null {
  return (db.prepare(`
    SELECT e.*, p.name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    WHERE e.id = ?
  `).get(id) as Expense) ?? null;
}

export function insertExpense(db: Database.Database, input: ExpenseInput): number {
  const result = db.prepare(`
    INSERT INTO expenses (person_id,car_id,date,amount,description,category) VALUES (?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date, input.amount,
    input.description ?? null, input.category ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateExpense(db: Database.Database, id: number, input: ExpenseInput): void {
  db.prepare(`
    UPDATE expenses SET person_id=?,car_id=?,date=?,amount=?,description=?,category=? WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date, input.amount,
    input.description ?? null, input.category ?? null, id
  );
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM expenses WHERE id=?").run(id);
}
