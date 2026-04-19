# CarSharing — Plan 03: Types & Business Logic

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Define all shared TypeScript types and pure business-logic utilities (bedrag formula, balance formula) with tests.

**Architecture:** `types/index.ts` holds all domain types. `lib/formulas.ts` holds pure functions with no DB dependency — easy to test in isolation.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Domain types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```ts
export interface Person {
  id: number;
  name: string;
  korting: number;
  korting_long: number;
  active: 0 | 1;
}

export interface Car {
  id: number;
  short: string;
  name: string;
  prijs: number;
  merk: string | null;
  kleur: string | null;
}

export interface Rit {
  id: number;
  person_id: number;
  car_id: number;
  datum: string;       // ISO date "YYYY-MM-DD"
  start: number;
  eind: number;
  km: number;
  bedrag: number;
  locatie: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Tankbeurt {
  id: number;
  person_id: number;
  car_id: number;
  datum: string;
  bedrag: number;
  liter: number;
  prijs_liter: number;
  kilometerstand: number | null;
  bonnetje: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}

export interface Kost {
  id: number;
  person_id: number;
  car_id: number;
  datum: string;
  bedrag: number;
  omschrijving: string | null;
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

export interface Betaald {
  id: number;
  person_id: number;
  datum: string;
  bedrag: number;
  opmerking: string | null;
  year: number;
  // joined
  person_name?: string;
}

export interface DashboardRow {
  person_id: number;
  person_name: string;
  year: number;
  rit_aantal: number;
  rit_km: number;
  tank_aantal: number;
  tank_liter: number;
  rit_bedrag: number;
  tank_bedrag: number;
  kost_bedrag: number;
  totaal_bedrag: number;
  betaald_bedrag: number;
  saldo_bedrag: number;
}

// Form input types (no id, no computed fields)
export type RitInput = Pick<Rit, "person_id"|"car_id"|"datum"|"start"|"eind"|"locatie">;
export type TankbeurtInput = Pick<Tankbeurt, "person_id"|"car_id"|"datum"|"bedrag"|"liter"|"kilometerstand"|"bonnetje">;
export type KostInput = Pick<Kost, "person_id"|"car_id"|"datum"|"bedrag"|"omschrijving">;
export type ReservationInput = Pick<Reservation, "person_id"|"car_id"|"start_date"|"end_date">;
export type BetaaldInput = Pick<Betaald, "person_id"|"datum"|"bedrag"|"opmerking">;
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: domain types"
```

---

### Task 2: Business logic — bedrag formula

**Files:**
- Create: `lib/formulas.ts`
- Create: `lib/__tests__/formulas.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/__tests__/formulas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcBedrag, calcPrijsPerLiter, calcBetaaldYear } from "../formulas";

describe("calcBedrag", () => {
  it("charges full price when person has no discount", () => {
    // Roeland, LEW prijs=0.25, korting=0, korting_long=0, km=8029
    expect(calcBedrag(8029, 0.25, 0, 0)).toBeCloseTo(2007.25);
  });

  it("applies short-trip discount for first 500km, long discount beyond", () => {
    // Tinne, JF prijs=0.20, korting=0.25, korting_long=0.50, km=2299
    // 500 * 0.20 * (1-0.25) + 1799 * 0.20 * (1-0.50)
    // = 75 + 179.90 = 254.90
    expect(calcBedrag(2299, 0.20, 0.25, 0.50)).toBeCloseTo(254.90);
  });

  it("applies only short-trip rate for trips <= 500km", () => {
    // 100km, prijs=0.20, korting=0.25
    // 100 * 0.20 * (1-0.25) = 15.00
    expect(calcBedrag(100, 0.20, 0.25, 0.50)).toBeCloseTo(15.00);
  });

  it("handles exactly 500km", () => {
    // 500 * 0.20 * (1-0.25) = 75.00
    expect(calcBedrag(500, 0.20, 0.25, 0.50)).toBeCloseTo(75.00);
  });
});

describe("calcPrijsPerLiter", () => {
  it("divides bedrag by liter", () => {
    expect(calcPrijsPerLiter(50, 22.8)).toBeCloseTo(2.19, 2);
  });
});

describe("calcBetaaldYear", () => {
  it("returns year minus 1", () => {
    expect(calcBetaaldYear("2026-01-08")).toBe(2025);
    expect(calcBetaaldYear("2019-01-04")).toBe(2018);
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
export function calcBedrag(
  km: number,
  prijs: number,
  korting: number,
  kortingLong: number
): number {
  const shortKm = Math.min(km, 500);
  const longKm = Math.max(km - 500, 0);
  return (
    prijs * shortKm * (1 - korting) +
    prijs * longKm * (1 - kortingLong)
  );
}

export function calcPrijsPerLiter(bedrag: number, liter: number): number {
  if (liter === 0) return 0;
  return bedrag / liter;
}

export function calcBetaaldYear(datum: string): number {
  return new Date(datum).getFullYear() - 1;
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
git commit -m "feat: bedrag and betaald-year formula with tests"
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
    .prepare("INSERT INTO people (name,korting,korting_long,active) VALUES (?,?,?,?)")
    .run(data.name, data.korting, data.korting_long, data.active);
  return result.lastInsertRowid as number;
}

export function updatePerson(db: Database.Database, id: number, data: Omit<Person, "id">): void {
  db.prepare("UPDATE people SET name=?,korting=?,korting_long=?,active=? WHERE id=?")
    .run(data.name, data.korting, data.korting_long, data.active, id);
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
    .prepare("INSERT INTO cars (short,name,prijs,merk,kleur) VALUES (?,?,?,?,?)")
    .run(data.short, data.name, data.prijs, data.merk, data.kleur);
  return result.lastInsertRowid as number;
}

export function updateCar(db: Database.Database, id: number, data: Omit<Car, "id">): void {
  db.prepare("UPDATE cars SET short=?,name=?,prijs=?,merk=?,kleur=? WHERE id=?")
    .run(data.short, data.name, data.prijs, data.merk, data.kleur, id);
}
```

- [ ] **Step 3: Write query tests**

Append to `lib/__tests__/queries.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
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
    const id = insertPerson(db, { name: "Roeland", korting: 0, korting_long: 0, active: 1 });
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
    insertCar(db, { short: "JF", name: "Jean-Francois", prijs: 0.20, merk: "Toyota", kleur: "wit" });
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
