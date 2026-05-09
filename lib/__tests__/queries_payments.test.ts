// lib/__tests__/queries_payments.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import {
  getPayments,
  getPaymentById,
  insertPayment,
  updatePayment,
  deletePayment,
  getPaymentsByYear,
} from "../queries/payments";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  db.exec(`INSERT INTO people (id, name, first_name, last_name, active) VALUES (1, 'Alice', 'Alice', '', 1), (2, 'Bob', 'Bob', '', 1)`);
}

describe("getPayments", () => {
  it("returns empty array when no payments exist", () => {
    const db = makeDb();
    seed(db);
    expect(getPayments(db)).toEqual([]);
  });

  it("returns all payments with joined person_name", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 150, note: null });
    const list = getPayments(db);
    expect(list).toHaveLength(1);
    expect(list[0].person_name).toBe("Alice");
    expect(list[0].amount).toBe(150);
  });

  it("orders by date DESC then id DESC", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 1, date: "2027-01-01", amount: 10, note: null });
    insertPayment(db, { person_id: 1, date: "2027-06-01", amount: 20, note: null });
    const list = getPayments(db);
    expect(list[0].amount).toBe(20);
    expect(list[1].amount).toBe(10);
  });
});

describe("getPaymentById", () => {
  it("returns the correct payment", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, {
      person_id: 1,
      date: "2027-03-01",
      amount: 200,
      note: "Settlement",
    });
    const payment = getPaymentById(db, id);
    expect(payment?.id).toBe(id);
    expect(payment?.amount).toBe(200);
    expect(payment?.note).toBe("Settlement");
    expect(payment?.person_name).toBe("Alice");
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(getPaymentById(db, 9999)).toBeNull();
  });
});

describe("insertPayment", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 100, note: null });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("computes year as date.year - 1 (payment settles previous year)", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, { person_id: 1, date: "2027-03-15", amount: 100, note: null });
    const payment = getPaymentById(db, id);
    expect(payment?.year).toBe(2026);
  });

  it("stores note when provided", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, {
      person_id: 1,
      date: "2027-03-01",
      amount: 50,
      note: "Annual settlement",
    });
    expect(getPaymentById(db, id)?.note).toBe("Annual settlement");
  });

  it("stores null note", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 50, note: null });
    expect(getPaymentById(db, id)?.note).toBeNull();
  });

  it("inserts multiple payments for different people", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 100, note: null });
    insertPayment(db, { person_id: 2, date: "2027-03-02", amount: 200, note: null });
    expect(getPayments(db)).toHaveLength(2);
  });
});

describe("updatePayment", () => {
  it("updates all fields of a payment", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, {
      person_id: 1,
      date: "2027-03-01",
      amount: 100,
      note: "Old note",
    });
    updatePayment(db, id, { person_id: 2, date: "2028-06-15", amount: 250, note: "New note" });
    const payment = getPaymentById(db, id);
    expect(payment?.person_name).toBe("Bob");
    expect(payment?.date).toBe("2028-06-15");
    expect(payment?.amount).toBe(250);
    expect(payment?.note).toBe("New note");
    // year = 2028 - 1 = 2027
    expect(payment?.year).toBe(2027);
  });

  it("recalculates year on update", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 100, note: null });
    updatePayment(db, id, { person_id: 1, date: "2029-01-10", amount: 100, note: null });
    expect(getPaymentById(db, id)?.year).toBe(2028);
  });

  it("does nothing for non-existent id without throwing", () => {
    const db = makeDb();
    seed(db);
    expect(() =>
      updatePayment(db, 9999, { person_id: 1, date: "2027-01-01", amount: 50, note: null })
    ).not.toThrow();
  });
});

describe("deletePayment", () => {
  it("removes the payment from the DB", () => {
    const db = makeDb();
    seed(db);
    const id = insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 100, note: null });
    deletePayment(db, id);
    expect(getPaymentById(db, id)).toBeNull();
    expect(getPayments(db)).toHaveLength(0);
  });

  it("does not throw for non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(() => deletePayment(db, 9999)).not.toThrow();
  });
});

describe("getPaymentsByYear", () => {
  it("returns empty map when no payments exist for year", () => {
    const db = makeDb();
    seed(db);
    const map = getPaymentsByYear(db, 2025);
    expect(map.size).toBe(0);
  });

  it("returns individual payment rows per person for the correct year", () => {
    const db = makeDb();
    seed(db);
    // Alice pays 100 for year 2025 (date 2026-03-01 → year = 2025)
    insertPayment(db, { person_id: 1, date: "2026-03-01", amount: 100, note: null });
    insertPayment(db, { person_id: 1, date: "2026-04-01", amount: 50, note: null });
    // Bob pays for 2025
    insertPayment(db, { person_id: 2, date: "2026-02-01", amount: 75, note: null });
    // Alice pays for 2026 (date 2027-03-01 → year = 2026) — must NOT appear
    insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 999, note: null });

    const map = getPaymentsByYear(db, 2025);
    expect(map.size).toBe(2);
    expect(map.has(1)).toBe(true);
    const aliceRows = map.get(1)!;
    expect(aliceRows).toHaveLength(2);
    expect(aliceRows.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(150, 2);
    expect(aliceRows[0].date).toBe("2026-03-01");
    expect(aliceRows[1].date).toBe("2026-04-01");
    const bobRows = map.get(2)!;
    expect(bobRows).toHaveLength(1);
    expect(bobRows[0].amount).toBeCloseTo(75, 2);
  });

  it("returns 0 for year with no payments", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 1, date: "2026-03-01", amount: 100, note: null });
    const map = getPaymentsByYear(db, 2024);
    expect(map.size).toBe(0);
  });
});
