import type Database from "better-sqlite3";
import type { DashboardRow } from "@/types";
import { shortNameOf } from "@/lib/person-utils";

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
  expense_count: number;
  expense_amount: number;
}
interface PaymentAgg {
  person_id: number;
  paid_amount: number;
}

interface OwnCarRow {
  owner_person_id: number;
  car_id: number;
  car_short: string;
  car_name: string;
  others_trip_count: number;
  others_trip_km: number;
  others_trip_amount: number;
  others_fuel_count: number;
  others_fuel_liters: number;
  others_fuel_amount: number;
  others_expense_count: number;
  others_expense_amount: number;
  others_fuel_settled_count: number;
  others_fuel_settled_liters: number;
  others_expense_settled_count: number;
  others_expense_settled_amount: number;
  own_trip_count: number;
  own_trip_km: number;
  own_fuel_count: number;
  own_fuel_liters: number;
  own_expense_count: number;
}

interface CrossCarRow {
  person_id: number;
  car_id: number;
  car_short: string;
  car_name: string;
  trip_count: number;
  trip_km: number;
  trip_amount: number;
  fuel_count: number;
  fuel_liters: number;
  fuel_amount: number;
  expense_count: number;
  expense_amount: number;
  fuel_settled_count: number;
  fuel_settled_liters: number;
  expense_settled_count: number;
  expense_settled_amount: number;
}

export function getEarliestYear(db: Database.Database): number {
  const row = db
    .prepare(
      `
    SELECT MIN(earliest) as year FROM (
      SELECT MIN(CAST(strftime('%Y', date) AS INTEGER)) as earliest FROM trips
      UNION ALL
      SELECT MIN(CAST(strftime('%Y', date) AS INTEGER)) FROM fuel_fillups
      UNION ALL
      SELECT MIN(CAST(strftime('%Y', date) AS INTEGER)) FROM expenses
    )
  `
    )
    .get() as { year: number | null };
  return row.year ?? new Date().getFullYear();
}

export function getDashboard(db: Database.Database, year: number): DashboardRow[] {
  const yearStr = String(year);

  const people = db.prepare("SELECT id, first_name, username FROM people ORDER BY first_name, last_name").all() as {
    id: number;
    first_name: string;
    username: string | null;
  }[];

  const tripRows = db
    .prepare(
      `
      SELECT person_id,
             COUNT(*)                AS trip_count,
             COALESCE(SUM(km),0)     AS trip_km,
             COALESCE(SUM(amount),0) AS trip_amount
      FROM trips
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `
    )
    .all(yearStr) as TripAgg[];

  const fuelRows = db
    .prepare(
      `
      SELECT person_id,
             COUNT(*)                AS fuel_count,
             COALESCE(SUM(liters),0) AS fuel_liters,
             COALESCE(SUM(amount),0) AS fuel_amount
      FROM fuel_fillups
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `
    )
    .all(yearStr) as FuelAgg[];

  const expenseRows = db
    .prepare(
      `
      SELECT person_id,
             COUNT(*)                AS expense_count,
             COALESCE(SUM(amount),0) AS expense_amount
      FROM expenses
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `
    )
    .all(yearStr) as ExpenseAgg[];

  const paymentRows = db
    .prepare(
      `
      SELECT person_id,
             COALESCE(SUM(amount),0) AS paid_amount
      FROM payments
      WHERE year = ?
      GROUP BY person_id
    `
    )
    .all(year) as PaymentAgg[];

  // Owners: per-car breakdown for cars they own
  const ownCarRows = db
    .prepare(
      `
      SELECT
        p_owner.id                                                          AS owner_person_id,
        c.id                                                                AS car_id,
        c.short                                                             AS car_short,
        c.name                                                              AS car_name,
        COUNT(CASE WHEN t.person_id != p_owner.id THEN 1 END)              AS others_trip_count,
        COALESCE(SUM(CASE WHEN t.person_id != p_owner.id THEN t.km END), 0)     AS others_trip_km,
        COALESCE(SUM(CASE WHEN t.person_id != p_owner.id THEN t.amount END), 0) AS others_trip_amount,
        COALESCE((SELECT COUNT(*) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id != p_owner.id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS others_fuel_count,
        COALESCE((SELECT SUM(f.liters) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id != p_owner.id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS others_fuel_liters,
        COALESCE((SELECT SUM(f.amount) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id != p_owner.id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS others_fuel_amount,
        COALESCE((SELECT COUNT(*) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id != p_owner.id
            AND e.settled_outside = 0 AND strftime('%Y', e.date) = ?), 0)  AS others_expense_count,
        COALESCE((SELECT SUM(e.amount) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id != p_owner.id
            AND e.settled_outside = 0 AND strftime('%Y', e.date) = ?), 0)  AS others_expense_amount,
        COALESCE((SELECT COUNT(*) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id != p_owner.id
            AND f.settled_outside = 1 AND strftime('%Y', f.date) = ?), 0)  AS others_fuel_settled_count,
        COALESCE((SELECT SUM(f.liters) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id != p_owner.id
            AND f.settled_outside = 1 AND strftime('%Y', f.date) = ?), 0)  AS others_fuel_settled_liters,
        COALESCE((SELECT COUNT(*) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id != p_owner.id
            AND e.settled_outside = 1 AND strftime('%Y', e.date) = ?), 0)  AS others_expense_settled_count,
        COALESCE((SELECT SUM(e.amount) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id != p_owner.id
            AND e.settled_outside = 1 AND strftime('%Y', e.date) = ?), 0)  AS others_expense_settled_amount,
        COUNT(CASE WHEN t.person_id = p_owner.id THEN 1 END)               AS own_trip_count,
        COALESCE(SUM(CASE WHEN t.person_id = p_owner.id THEN t.km END), 0) AS own_trip_km,
        COALESCE((SELECT COUNT(*) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = p_owner.id
            AND strftime('%Y', f.date) = ?), 0)                            AS own_fuel_count,
        COALESCE((SELECT SUM(f.liters) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = p_owner.id
            AND strftime('%Y', f.date) = ?), 0)                            AS own_fuel_liters,
        COALESCE((SELECT COUNT(*) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id = p_owner.id
            AND strftime('%Y', e.date) = ?), 0)                            AS own_expense_count
      FROM cars c
      JOIN people p_owner ON c.owner_person_id = p_owner.id
      LEFT JOIN trips t ON t.car_id = c.id AND strftime('%Y', t.date) = ?
      WHERE c.owner_person_id IS NOT NULL
      GROUP BY c.id, p_owner.id
      `
    )
    .all(
      yearStr, // others_fuel_count
      yearStr, // others_fuel_liters
      yearStr, // others_fuel_amount
      yearStr, // others_expense_count
      yearStr, // others_expense_amount
      yearStr, // others_fuel_settled_count
      yearStr, // others_fuel_settled_liters
      yearStr, // others_expense_settled_count
      yearStr, // others_expense_settled_amount
      yearStr, // own_fuel_count
      yearStr, // own_fuel_liters
      yearStr, // own_expense_count
      yearStr  // LEFT JOIN trips date filter
    ) as OwnCarRow[];

  // Owners: trips/fuel/expenses on OTHER owners' cars
  const crossCarRows = db
    .prepare(
      `
      SELECT
        t.person_id                                                         AS person_id,
        c.id                                                                AS car_id,
        c.short                                                             AS car_short,
        c.name                                                              AS car_name,
        COUNT(t.id)                                                         AS trip_count,
        COALESCE(SUM(t.km), 0)                                             AS trip_km,
        COALESCE(SUM(t.amount), 0)                                         AS trip_amount,
        COALESCE((SELECT COUNT(*) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = t.person_id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS fuel_count,
        COALESCE((SELECT SUM(f.liters) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = t.person_id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS fuel_liters,
        COALESCE((SELECT SUM(f.amount) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = t.person_id
            AND f.settled_outside = 0 AND strftime('%Y', f.date) = ?), 0)  AS fuel_amount,
        COALESCE((SELECT COUNT(*) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id = t.person_id
            AND e.settled_outside = 0 AND strftime('%Y', e.date) = ?), 0)  AS expense_count,
        COALESCE((SELECT SUM(e.amount) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id = t.person_id
            AND e.settled_outside = 0 AND strftime('%Y', e.date) = ?), 0)  AS expense_amount,
        COALESCE((SELECT COUNT(*) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = t.person_id
            AND f.settled_outside = 1 AND strftime('%Y', f.date) = ?), 0)  AS fuel_settled_count,
        COALESCE((SELECT SUM(f.liters) FROM fuel_fillups f
          WHERE f.car_id = c.id AND f.person_id = t.person_id
            AND f.settled_outside = 1 AND strftime('%Y', f.date) = ?), 0)  AS fuel_settled_liters,
        COALESCE((SELECT COUNT(*) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id = t.person_id
            AND e.settled_outside = 1 AND strftime('%Y', e.date) = ?), 0)  AS expense_settled_count,
        COALESCE((SELECT SUM(e.amount) FROM expenses e
          WHERE e.car_id = c.id AND e.person_id = t.person_id
            AND e.settled_outside = 1 AND strftime('%Y', e.date) = ?), 0)  AS expense_settled_amount
      FROM trips t
      JOIN cars c ON t.car_id = c.id
      JOIN people p_owner ON c.owner_person_id = p_owner.id
      WHERE t.person_id != p_owner.id
        AND c.owner_person_id IS NOT NULL
        AND strftime('%Y', t.date) = ?
      GROUP BY t.person_id, c.id
      `
    )
    .all(yearStr, yearStr, yearStr, yearStr, yearStr, yearStr, yearStr, yearStr, yearStr, yearStr) as CrossCarRow[];

  const ownCarByPerson = new Map<number, OwnCarRow[]>();
  for (const row of ownCarRows) {
    const list = ownCarByPerson.get(row.owner_person_id) ?? [];
    list.push(row);
    ownCarByPerson.set(row.owner_person_id, list);
  }

  const crossCarByPerson = new Map<number, CrossCarRow[]>();
  for (const row of crossCarRows) {
    const list = crossCarByPerson.get(row.person_id) ?? [];
    list.push(row);
    crossCarByPerson.set(row.person_id, list);
  }

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

    const ownCars = ownCarByPerson.get(person.id) ?? [];
    const crossCars = crossCarByPerson.get(person.id) ?? [];
    const is_owner = ownCars.length > 0;

    const car_breakdowns: import("@/types").CarDashboardBreakdown[] = [
      ...ownCars.map((c) => ({
        car_short: c.car_short,
        car_name: c.car_name,
        is_own_car: true as const,
        trip_count: c.others_trip_count,
        trip_km: c.others_trip_km,
        trip_amount: c.others_trip_amount,
        fuel_count: c.others_fuel_count,
        fuel_liters: c.others_fuel_liters,
        fuel_amount: c.others_fuel_amount,
        expense_count: c.others_expense_count,
        expense_amount: c.others_expense_amount,
        net_car:
          Math.round(
            (c.others_trip_amount - c.others_fuel_amount - c.others_expense_amount) * 100
          ) / 100,
        own_trip_count: c.own_trip_count,
        own_trip_km: c.own_trip_km,
        own_fuel_count: c.own_fuel_count,
        own_fuel_liters: c.own_fuel_liters,
        own_expense_count: c.own_expense_count,
        fuel_settled_count: c.others_fuel_settled_count,
        fuel_settled_liters: c.others_fuel_settled_liters,
        expense_settled_count: c.others_expense_settled_count,
        expense_settled_amount: c.others_expense_settled_amount,
      })),
      ...crossCars.map((c) => ({
        car_short: c.car_short,
        car_name: c.car_name,
        is_own_car: false as const,
        trip_count: c.trip_count,
        trip_km: c.trip_km,
        trip_amount: c.trip_amount,
        fuel_count: c.fuel_count,
        fuel_liters: c.fuel_liters,
        fuel_amount: c.fuel_amount,
        expense_count: c.expense_count,
        expense_amount: c.expense_amount,
        net_car: Math.round((-c.trip_amount + c.fuel_amount + c.expense_amount) * 100) / 100,
        own_trip_count: 0,
        own_trip_km: 0,
        own_fuel_count: 0,
        own_fuel_liters: 0,
        own_expense_count: 0,
        fuel_settled_count: c.fuel_settled_count,
        fuel_settled_liters: c.fuel_settled_liters,
        expense_settled_count: c.expense_settled_count,
        expense_settled_amount: c.expense_settled_amount,
      })),
    ];

    return {
      person_id: person.id,
      person_name: shortNameOf(person),
      year,
      trip_count: t?.trip_count ?? 0,
      trip_km: t?.trip_km ?? 0,
      fuel_count: f?.fuel_count ?? 0,
      fuel_liters: f?.fuel_liters ?? 0,
      expense_count: e?.expense_count ?? 0,
      trip_amount,
      fuel_amount,
      expense_amount,
      total_amount,
      paid_amount,
      balance,
      is_owner,
      car_breakdowns,
    };
  });
}
