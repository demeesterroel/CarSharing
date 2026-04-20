import type Database from "better-sqlite3";
import type { DashboardRow } from "@/types";

interface TripAgg {
  person_id: number;
  trip_count: number;
  trip_km: number;
  trip_amount: number;
}
interface FuelAgg {
  person_id: number;
  fuel_count: number;
  fuel_liters: number;
  fuel_amount: number;
}
interface ExpenseAgg {
  person_id: number;
  expense_amount: number;
}
interface PaymentAgg {
  person_id: number;
  paid_amount: number;
}

export function getDashboard(db: Database.Database, year: number): DashboardRow[] {
  const yearStr = String(year);

  const people = db
    .prepare("SELECT id, name FROM people ORDER BY name")
    .all() as { id: number; name: string }[];

  const tripRows = db
    .prepare(`
      SELECT person_id,
             COUNT(*)                AS trip_count,
             COALESCE(SUM(km),0)     AS trip_km,
             COALESCE(SUM(amount),0) AS trip_amount
      FROM trips
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as TripAgg[];

  const fuelRows = db
    .prepare(`
      SELECT person_id,
             COUNT(*)                AS fuel_count,
             COALESCE(SUM(liters),0) AS fuel_liters,
             COALESCE(SUM(amount),0) AS fuel_amount
      FROM fuel_fillups
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as FuelAgg[];

  const expenseRows = db
    .prepare(`
      SELECT person_id,
             COALESCE(SUM(amount),0) AS expense_amount
      FROM expenses
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as ExpenseAgg[];

  const paymentRows = db
    .prepare(`
      SELECT person_id,
             COALESCE(SUM(amount),0) AS paid_amount
      FROM payments
      WHERE year = ?
      GROUP BY person_id
    `)
    .all(year) as PaymentAgg[];

  const byId = <T extends { person_id: number }>(rows: T[]) =>
    new Map<number, T>(rows.map((r) => [r.person_id, r]));
  const trips = byId(tripRows);
  const fuel = byId(fuelRows);
  const expenses = byId(expenseRows);
  const payments = byId(paymentRows);

  return people.map((person) => {
    const t = trips.get(person.id);
    const f = fuel.get(person.id);
    const e = expenses.get(person.id);
    const p = payments.get(person.id);

    const trip_amount = -(t?.trip_amount ?? 0);
    const fuel_amount = f?.fuel_amount ?? 0;
    const expense_amount = e?.expense_amount ?? 0;
    const paid_amount = p?.paid_amount ?? 0;

    const total_amount = trip_amount + fuel_amount + expense_amount;
    const balance = total_amount + paid_amount;

    return {
      person_id: person.id,
      person_name: person.name,
      year,
      trip_count: t?.trip_count ?? 0,
      trip_km: t?.trip_km ?? 0,
      fuel_count: f?.fuel_count ?? 0,
      fuel_liters: f?.fuel_liters ?? 0,
      trip_amount,
      fuel_amount,
      expense_amount,
      total_amount,
      paid_amount,
      balance,
    };
  });
}
