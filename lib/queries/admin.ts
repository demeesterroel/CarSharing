import type Database from "better-sqlite3";
import type { FixedCostItem, FixedCostCategory } from "@/types";

const VALID_CATEGORIES: FixedCostCategory[] = [
  "belastingen", "verzekeringen", "onderhoud", "keuring", "diversen",
];

function parseFixedCosts(json: string): FixedCostItem[] {
  try {
    const parsed = JSON.parse(json);
    // New format: array of { id, category, description, amount }
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (fc): fc is FixedCostItem =>
          typeof fc === "object" &&
          typeof fc.amount === "number" &&
          VALID_CATEGORIES.includes(fc.category)
      );
    }
    // Legacy format: { verzekering, belasting, keuring, afschrijving }
    const legacyMap: Record<string, FixedCostCategory> = {
      verzekering: "verzekeringen",
      belasting: "belastingen",
      keuring: "keuring",
      afschrijving: "diversen",
    };
    return Object.entries(parsed)
      .filter(([, v]) => typeof v === "number" && (v as number) > 0)
      .map(([k, v], i) => ({
        id: `legacy-${i}`,
        category: legacyMap[k] ?? "diversen",
        description: k,
        amount: v as number,
      }));
  } catch {
    return [];
  }
}

export interface CarPnL {
  car_id: number;
  car_short: string;
  car_name: string;
  car_price_per_km: number;
  owner_name: string | null;
  long_threshold: number;
  fixed_costs: FixedCostItem[];
  expected_km: number | null;
  // aggregates (calendar year)
  trip_count: number;
  trip_km: number;
  trip_revenue: number;
  fuel_count: number;
  fuel_amount: number;
  expense_count: number;
  expense_amount: number;
  fixed_total: number;
  // derived
  variable_total: number;   // fuel + expense
  total_cost: number;       // fuel + expense + fixed
  net_to_owner: number;     // trip_revenue - total_cost
  cost_per_km: number;      // total_cost / trip_km (or 0)
  prev_year_trip_km: number;
}

export interface KmGap {
  car_short: string;
  after_trip_id: number;
  after_date: string;
  after_end: number;
  before_trip_id: number;
  before_date: string;
  before_start: number;
  missing_km: number;
}

export interface MonthlyCarKm {
  car_id: number;
  year_month: string; // "YYYY-MM"
  km: number;
}

export interface PersonContribution {
  car_id: number;
  person_id: number;
  person_name: string;
  km: number;
}

export interface CarYearKm {
  car_id: number;
  year: number;
  km: number;
}

export function getCarPnL(db: Database.Database, year: number): CarPnL[] {
  const yearStr = String(year);
  const prevYearStr = String(year - 1);

  const cars = db.prepare("SELECT * FROM cars ORDER BY short").all() as {
    id: number; short: string; name: string; price_per_km: number;
    owner_name: string | null; long_threshold: number; fixed_costs_json: string | null;
    expected_km: number | null;
  }[];

  return cars.map((car) => {
    const fixed_costs: FixedCostItem[] = car.fixed_costs_json
      ? parseFixedCosts(car.fixed_costs_json)
      : [];
    const fixed_total = fixed_costs.reduce((s, fc) => s + fc.amount, 0);

    const trips = db.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(km),0) AS km, COALESCE(SUM(amount),0) AS rev
      FROM trips WHERE car_id=? AND strftime('%Y',date)=?
    `).get(car.id, yearStr) as { cnt: number; km: number; rev: number };

    const fuel = db.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amt
      FROM fuel_fillups WHERE car_id=? AND strftime('%Y',date)=?
    `).get(car.id, yearStr) as { cnt: number; amt: number };

    const exp = db.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amt
      FROM expenses WHERE car_id=? AND strftime('%Y',date)=?
    `).get(car.id, yearStr) as { cnt: number; amt: number };

    const prevTrips = db.prepare(`
      SELECT COALESCE(SUM(km),0) AS km FROM trips WHERE car_id=? AND strftime('%Y',date)=?
    `).get(car.id, prevYearStr) as { km: number };

    const variable_total = fuel.amt + exp.amt;
    const total_cost = variable_total + fixed_total;
    const net_to_owner = trips.rev - total_cost;
    const cost_per_km = trips.km > 0 ? total_cost / trips.km : 0;

    return {
      car_id: car.id,
      car_short: car.short,
      car_name: car.name,
      car_price_per_km: car.price_per_km,
      owner_name: car.owner_name,
      long_threshold: car.long_threshold,
      fixed_costs,
      expected_km: car.expected_km,
      trip_count: trips.cnt,
      trip_km: trips.km,
      trip_revenue: trips.rev,
      fuel_count: fuel.cnt,
      fuel_amount: fuel.amt,
      expense_count: exp.cnt,
      expense_amount: exp.amt,
      fixed_total,
      variable_total,
      total_cost,
      net_to_owner,
      cost_per_km,
      prev_year_trip_km: prevTrips.km,
    };
  });
}

export function getMonthlyCarKm(db: Database.Database, year: number): MonthlyCarKm[] {
  return db.prepare(`
    SELECT car_id, strftime('%Y-%m', date) AS year_month, SUM(km) AS km
    FROM trips
    WHERE strftime('%Y', date) = ?
    GROUP BY car_id, year_month
    ORDER BY car_id, year_month
  `).all(String(year)) as MonthlyCarKm[];
}

export function getPersonContributions(db: Database.Database, year: number): PersonContribution[] {
  return db.prepare(`
    SELECT t.car_id, t.person_id, p.name AS person_name, SUM(t.km) AS km
    FROM trips t
    JOIN people p ON p.id = t.person_id
    WHERE strftime('%Y', t.date) = ?
    GROUP BY t.car_id, t.person_id
    ORDER BY t.car_id, km DESC
  `).all(String(year)) as PersonContribution[];
}

export function getHistoricalCarKm(db: Database.Database, currentYear: number): CarYearKm[] {
  return db.prepare(`
    SELECT car_id, CAST(strftime('%Y', date) AS INTEGER) AS year, SUM(km) AS km
    FROM trips
    WHERE CAST(strftime('%Y', date) AS INTEGER) BETWEEN ? AND ?
    GROUP BY car_id, year
    ORDER BY car_id, year
  `).all(currentYear - 6, currentYear - 1) as CarYearKm[];
}

export interface CarPriceHistory {
  id: number;
  car_id: number;
  price_per_km: number;
  effective_from: string; // "YYYY-MM-DD"
}

export function getPriceHistory(db: Database.Database): CarPriceHistory[] {
  return db.prepare(`
    SELECT id, car_id, price_per_km, effective_from
    FROM car_price_history
    ORDER BY car_id, effective_from DESC
  `).all() as CarPriceHistory[];
}

export interface ZeroKmTrip {
  id: number;
  date: string;
  car_short: string;
  person_name: string;
}

export function getZeroKmTrips(db: Database.Database): ZeroKmTrip[] {
  return db.prepare(`
    SELECT t.id, t.date, c.short AS car_short, p.name AS person_name
    FROM trips t
    JOIN cars c ON c.id = t.car_id
    JOIN people p ON p.id = t.person_id
    WHERE t.km = 0
    ORDER BY t.date DESC
  `).all() as ZeroKmTrip[];
}

export function getKmGaps(db: Database.Database): KmGap[] {
  const gaps: KmGap[] = [];
  const cars = db.prepare("SELECT id, short FROM cars").all() as { id: number; short: string }[];

  for (const car of cars) {
    const trips = db.prepare(`
      SELECT id, date, start_odometer, end_odometer
      FROM trips WHERE car_id=? ORDER BY date ASC, end_odometer ASC
    `).all(car.id) as { id: number; date: string; start_odometer: number; end_odometer: number }[];

    for (let i = 1; i < trips.length; i++) {
      const prev = trips[i - 1];
      const cur  = trips[i];
      if (cur.start_odometer > prev.end_odometer + 1) {
        gaps.push({
          car_short: car.short,
          after_trip_id: prev.id,
          after_date: prev.date,
          after_end: prev.end_odometer,
          before_trip_id: cur.id,
          before_date: cur.date,
          before_start: cur.start_odometer,
          missing_km: cur.start_odometer - prev.end_odometer,
        });
      }
    }
  }
  return gaps;
}
