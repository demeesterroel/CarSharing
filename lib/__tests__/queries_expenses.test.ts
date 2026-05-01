// lib/__tests__/queries_expenses.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import {
  getExpenses,
  getExpenseById,
  insertExpense,
  updateExpense,
  deleteExpense,
  ConflictError,
} from "../queries/expenses";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  db.exec(`INSERT INTO people (id, name, active) VALUES (1, 'Alice', 1), (2, 'Bob', 1)`);
  db.exec(
    `INSERT INTO cars (id, short, name, price_per_km, owner_name, owner_from, active) VALUES (1, 'CA', 'Car A', 0.2, 'Alice', '2020-01-01', 1)`
  );
}

describe("getExpenses", () => {
  it("returns empty array when no expenses exist", () => {
    const db = makeDb();
    seed(db);
    expect(getExpenses(db)).toEqual([]);
  });

  it("returns all expenses with joined person_name and car_short", () => {
    const db = makeDb();
    seed(db);
    insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-03-01",
      amount: 50,
      description: "Oil change",
    });
    const list = getExpenses(db);
    expect(list).toHaveLength(1);
    expect(list[0].person_name).toBe("Alice");
    expect(list[0].car_short).toBe("CA");
    expect(list[0].amount).toBe(50);
  });

  it("orders by date DESC then id DESC", () => {
    const db = makeDb();
    seed(db);
    insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-03-01",
      amount: 10,
      description: "First",
    });
    insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-04-01",
      amount: 20,
      description: "Second",
    });
    const list = getExpenses(db);
    expect(list[0].description).toBe("Second");
    expect(list[1].description).toBe("First");
  });
});

describe("getExpenseById", () => {
  it("returns the correct expense", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-03-01",
      amount: 75,
      description: "Tires",
    });
    const expense = getExpenseById(db, id);
    expect(expense?.id).toBe(id);
    expect(expense?.amount).toBe(75);
    expect(expense?.description).toBe("Tires");
    expect(expense?.person_name).toBe("Alice");
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(getExpenseById(db, 9999)).toBeNull();
  });
});

describe("insertExpense", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 30,
      description: "wash",
    });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("stores category when provided", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 100,
      description: "Insurance",
      category: "verzekering",
    });
    expect(getExpenseById(db, id)?.category).toBe("verzekering");
  });

  it("stores settled_outside flag", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 50,
      description: "External",
      settled_outside: 1,
    });
    expect(getExpenseById(db, id)?.settled_outside).toBe(1);
  });

  it("idempotency: returns existing id when client_id already exists", () => {
    const db = makeDb();
    seed(db);
    const id1 = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 50,
      description: "First",
      client_id: "expense-abc",
    });
    const id2 = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-02-01",
      amount: 99,
      description: "Second",
      client_id: "expense-abc",
    });
    expect(id2).toBe(id1);
    expect(getExpenses(db)).toHaveLength(1);
  });

  it("stores null description when not provided", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 40,
      description: null,
    });
    expect(getExpenseById(db, id)?.description).toBeNull();
  });
});

describe("updateExpense", () => {
  it("updates all fields of an expense", () => {
    const db = makeDb();
    seed(db);
    db.exec(`INSERT INTO people (id, name, active) VALUES (3, 'Carol', 1)`);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 30,
      description: "Old",
    });
    updateExpense(db, id, {
      person_id: 3,
      car_id: 1,
      date: "2026-06-01",
      amount: 99,
      description: "New description",
      category: "onderhoud",
      settled_outside: 1,
    });
    const expense = getExpenseById(db, id);
    expect(expense?.person_name).toBe("Carol");
    expect(expense?.date).toBe("2026-06-01");
    expect(expense?.amount).toBe(99);
    expect(expense?.description).toBe("New description");
    expect(expense?.category).toBe("onderhoud");
    expect(expense?.settled_outside).toBe(1);
  });

  it("with expectedUpdatedAt: succeeds when timestamp matches", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 30,
      description: "Check",
    });
    const expense = getExpenseById(db, id)!;
    expect(() =>
      updateExpense(
        db,
        id,
        { person_id: 1, car_id: 1, date: "2026-01-01", amount: 30, description: "Updated" },
        { expectedUpdatedAt: expense.updated_at }
      )
    ).not.toThrow();
  });

  it("with expectedUpdatedAt: throws ConflictError when timestamp mismatches", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 30,
      description: "Check",
    });
    expect(() =>
      updateExpense(
        db,
        id,
        { person_id: 1, car_id: 1, date: "2026-01-01", amount: 30, description: "X" },
        { expectedUpdatedAt: "1999-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });

  it("with expectedUpdatedAt: throws ConflictError when expense no longer exists", () => {
    const db = makeDb();
    seed(db);
    expect(() =>
      updateExpense(
        db,
        9999,
        { person_id: 1, car_id: 1, date: "2026-01-01", amount: 10, description: "Ghost" },
        { expectedUpdatedAt: "2026-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });
});

describe("deleteExpense", () => {
  it("removes the expense from the DB", () => {
    const db = makeDb();
    seed(db);
    const id = insertExpense(db, {
      person_id: 1,
      car_id: 1,
      date: "2026-01-01",
      amount: 30,
      description: "Delete me",
    });
    deleteExpense(db, id);
    expect(getExpenseById(db, id)).toBeNull();
    expect(getExpenses(db)).toHaveLength(0);
  });

  it("does not throw for non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(() => deleteExpense(db, 9999)).not.toThrow();
  });
});
