# CarSharing — Plan 03: Types & Business Logic

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Define all shared TypeScript types (English field names matching the DB schema) and pure business-logic utilities with tests.

**Architecture:** `types/index.ts` holds all domain types. `lib/formulas.ts` holds pure functions with no DB dependency.

**Tech Stack:** TypeScript, Vitest.

---

### Column name mapping (Dutch AppSheet → English codebase)

| AppSheet | DB column / TypeScript field |
|---|---|
| Naam | person_name (joined) |
| Wagen | car_short (joined) |
| datum | date |
| start | start_odometer |
| eind | end_odometer |
| Kilometers | km |
| Bedrag | amount |
| Locatie | location |
| #liter | liters |
| prijs/liter | price_per_liter |
| kilometerstand | odometer |
| Bonnetje | receipt |
| Kosten (description) | description |
| Opmerking | note |
| korting | discount |
| korting_long | discount_long |
| prijs | price_per_km |
| merk | brand |
| kleur | color |

---

### Task 1: Domain types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```ts
export interface Person {
  id: number;
  name: string;
  discount: number;
  discount_long: number;
  active: 0 | 1;
}

export interface Car {
  id: number;
  short: string;
  name: string;
  price_per_km: number;
  brand: string | null;
  color: string | null;
}

export interface Trip {
  id: number;
  person_id: number;
  car_id: number;
  date: string;           // ISO date "YYYY-MM-DD"
  start_odometer: number;
  end_odometer: number;
  km: number;
  amount: number;
  location: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface FuelFillup {
  id: number;
  person_id: number;
  car_id: number;
  date: string;
  amount: number;
  liters: number;
  price_per_liter: number;
  odometer: number | null;
  receipt: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Expense {
  id: number;
  person_id: number;
  car_id: number;
  date: string;
  amount: number;
  description: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Reservation {
  id: number;
  person_id: number;
  car_id: number;
  start_date: string;
  end_date: string;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Payment {
  id: number;
  person_id: number;
  date: string;
  amount: number;
  note: string | null;
  year: number;           // date.year − 1 (payment settles previous year)
  // joined
  person_name?: string;
}

export interface DashboardRow {
  person_id: number;
  person_name: string;
  year: number;
  trip_count: number;
  trip_km: number;
  fuel_count: number;
  fuel_liters: number;
  trip_amount: number;     // negative (cost charged)
  fuel_amount: number;     // positive (fuel paid)
  expense_amount: number;  // positive (expenses paid)
  total_amount: number;    // trip_amount + fuel_amount + expense_amount
  paid_amount: number;     // settlement payments
  balance: number;         // total_amount + paid_amount
}

// Form input types (no id, no computed fields)
export type TripInput = Pick<Trip, "person_id"|"car_id"|"date"|"start_odometer"|"end_odometer"|"location">;
export type FuelFillupInput = Pick<FuelFillup, "person_id"|"car_id"|"date"|"amount"|"liters"|"odometer"|"receipt">;
export type ExpenseInput = Pick<Expense, "person_id"|"car_id"|"date"|"amount"|"description">;
export type ReservationInput = Pick<Reservation, "person_id"|"car_id"|"start_date"|"end_date">;
export type PaymentInput = Pick<Payment, "person_id"|"date"|"amount"|"note">;
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: domain types with english field names"
```

---

### Task 2: Business logic — amount formula

**Files:**
- Create: `lib/formulas.ts`
- Create: `lib/__tests__/formulas.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/__tests__/formulas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcTripAmount, calcPricePerLiter, calcPaymentYear } from "../formulas";

describe("calcTripAmount", () => {
  it("charges full price when person has no discount", () => {
    // Roeland, LEW price_per_km=0.25, discount=0, discount_long=0, km=8029
    expect(calcTripAmount(8029, 0.25, 0, 0)).toBeCloseTo(2007.25);
  });

  it("applies short-trip discount for first 500km, long discount beyond", () => {
    // Tinne, JF price_per_km=0.20, discount=0.25, discount_long=0.50, km=2299
    // 500 * 0.20 * (1-0.25) + 1799 * 0.20 * (1-0.50) = 75 + 179.90 = 254.90
    expect(calcTripAmount(2299, 0.20, 0.25, 0.50)).toBeCloseTo(254.90);
  });

  it("applies only short-trip rate for trips <= 500km", () => {
    // 100km, price_per_km=0.20, discount=0.25
    // 100 * 0.20 * (1-0.25) = 15.00
    expect(calcTripAmount(100, 0.20, 0.25, 0.50)).toBeCloseTo(15.00);
  });

  it("handles exactly 500km", () => {
    // 500 * 0.20 * (1-0.25) = 75.00
    expect(calcTripAmount(500, 0.20, 0.25, 0.50)).toBeCloseTo(75.00);
  });
});

describe("calcPricePerLiter", () => {
  it("divides amount by liters", () => {
    expect(calcPricePerLiter(50, 22.8)).toBeCloseTo(2.19, 2);
  });

  it("returns 0 when liters is 0", () => {
    expect(calcPricePerLiter(50, 0)).toBe(0);
  });
});

describe("calcPaymentYear", () => {
  it("returns year minus 1", () => {
    expect(calcPaymentYear("2026-01-08")).toBe(2025);
    expect(calcPaymentYear("2019-01-04")).toBe(2018);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test lib/__tests__/formulas.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create lib/formulas.ts**

```ts
export function calcTripAmount(
  km: number,
  pricePerKm: number,
  discount: number,
  discountLong: number
): number {
  const shortKm = Math.min(km, 500);
  const longKm = Math.max(km - 500, 0);
  return (
    pricePerKm * shortKm * (1 - discount) +
    pricePerKm * longKm * (1 - discountLong)
  );
}

export function calcPricePerLiter(amount: number, liters: number): number {
  if (liters === 0) return 0;
  return amount / liters;
}

export function calcPaymentYear(date: string): number {
  return new Date(date).getFullYear() - 1;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test lib/__tests__/formulas.test.ts
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/formulas.ts lib/__tests__/formulas.test.ts
git commit -m "feat: trip amount and payment year formulas with tests"
```

---

### Task 3: Query helpers — people & cars

**Files:**
- Create: `lib/queries/people.ts`
- Create: `lib/queries/cars.ts`
- Create: `lib/__tests__/queries.test.ts`

- [ ] **Step 1: Create lib/queries/people.ts**

```ts
import type Database from "better-sqlite3";
import type { Person } from "@/types";

export function getPeople(db: Database.Database): Person[] {
  return db.prepare("SELECT * FROM people ORDER BY name").all() as Person[];
}

export function getActivePeople(db: Database.Database): Person[] {
  return db.prepare("SELECT * FROM people WHERE active=1 ORDER BY name").all() as Person[];
}

export function getPersonById(db: Database.Database, id: number): Person | null {
  return (db.prepare("SELECT * FROM people WHERE id=?").get(id) as Person) ?? null;
}

export function insertPerson(db: Database.Database, data: Omit<Person, "id">): number {
  const result = db
    .prepare("INSERT INTO people (name,discount,discount_long,active) VALUES (?,?,?,?)")
    .run(data.name, data.discount, data.discount_long, data.active);
  return result.lastInsertRowid as number;
}

export function updatePerson(db: Database.Database, id: number, data: Omit<Person, "id">): void {
  db.prepare("UPDATE people SET name=?,discount=?,discount_long=?,active=? WHERE id=?")
    .run(data.name, data.discount, data.discount_long, data.active, id);
}
```

- [ ] **Step 2: Create lib/queries/cars.ts**

```ts
import type Database from "better-sqlite3";
import type { Car } from "@/types";

export function getCars(db: Database.Database): Car[] {
  return db.prepare("SELECT * FROM cars ORDER BY short").all() as Car[];
}

export function getCarById(db: Database.Database, id: number): Car | null {
  return (db.prepare("SELECT * FROM cars WHERE id=?").get(id) as Car) ?? null;
}

export function insertCar(db: Database.Database, data: Omit<Car, "id">): number {
  const result = db
    .prepare("INSERT INTO cars (short,name,price_per_km,brand,color) VALUES (?,?,?,?,?)")
    .run(data.short, data.name, data.price_per_km, data.brand, data.color);
  return result.lastInsertRowid as number;
}

export function updateCar(db: Database.Database, id: number, data: Omit<Car, "id">): void {
  db.prepare("UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=? WHERE id=?")
    .run(data.short, data.name, data.price_per_km, data.brand, data.color, id);
}
```

- [ ] **Step 3: Write query tests**

Create `lib/__tests__/queries.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../schema.sql";
import { getPeople, insertPerson, getPersonById } from "../queries/people";
import { getCars, insertCar } from "../queries/cars";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

describe("people queries", () => {
  it("inserts and retrieves a person", () => {
    const db = makeDb();
    const id = insertPerson(db, { name: "Roeland", discount: 0, discount_long: 0, active: 1 });
    const person = getPersonById(db, id);
    expect(person?.name).toBe("Roeland");
  });

  it("returns empty array when no people", () => {
    const db = makeDb();
    expect(getPeople(db)).toEqual([]);
  });
});

describe("cars queries", () => {
  it("inserts and retrieves cars", () => {
    const db = makeDb();
    insertCar(db, { short: "JF", name: "Jean-Francois", price_per_km: 0.20, brand: "Toyota", color: "wit" });
    const cars = getCars(db);
    expect(cars).toHaveLength(1);
    expect(cars[0].short).toBe("JF");
  });
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test lib/__tests__/
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/ lib/__tests__/queries.test.ts
git commit -m "feat: people and cars query helpers with tests"
```
