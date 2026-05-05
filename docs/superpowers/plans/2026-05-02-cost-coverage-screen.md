# Cost Coverage Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate Break-Even + Rate Assistant screens in the owner view with a single merged "Kostendekking" screen that shows YTD actuals, a 4-zone tier bar, and five history-backed sliders for live what-if forecasting.

**Architecture:** Three new SQL queries (rolling fuel/km, historical owner split, historical expenses) are added to `lib/queries/admin.ts`, exposed via the existing `/api/admin/summary` endpoint, and consumed by a new `CostCoverageScreen` component that replaces both the `detail` and `rate` URL views in `OwnerFleet`. The FleetTiles admin view keeps `BreakEvenCard` unchanged.

**Tech Stack:** SQLite / better-sqlite3, React / Next.js App Router, inline CSS (paper-theme), react-query, Vitest

---

## Economic model recap

For each car:

```
non_owner_km   = total_km × pct_others
owner_km       = total_km × (1 − pct_others)
markup_per_km  = price_per_km − fuel_per_km
non_owner_markup = markup_per_km × non_owner_km
owner_fuel_cost  = fuel_per_km × owner_km

Zone thresholds (price/km):
  RED boundary        = fuel_per_km                              (markup turns positive)
  ORANGE→LIGHT GREEN  = fuel_per_km + expenses / non_owner_km   (expenses fully covered)
  LIGHT→DARK GREEN    = fuel_per_km + (expenses + owner_fuel_cost) / non_owner_km
```

---

## File map

| File | Action | Purpose |
|---|---|---|
| `lib/queries/admin.ts` | Modify | 3 new query functions + 3 new interfaces |
| `lib/__tests__/queries_admin.test.ts` | Modify | Tests for new queries |
| `app/admin/_shared.tsx` | Modify | Extend `AdminSummary` with 3 new fields |
| `app/api/admin/summary/route.ts` | Modify | Expose new data |
| `components/cost-coverage-screen.tsx` | Create | Merged owner screen |
| `app/admin/cars/page.tsx` | Modify | Wire CostCoverageScreen; remove rate view + rate button |
| `lib/i18n/messages/nl.ts` | Modify | New `coverage.*` keys |
| `lib/i18n/messages/en.ts` | Modify | New `coverage.*` keys |
| `components/rate-assistant.tsx` | Delete | Replaced by CostCoverageScreen |

---

## Task 1: Three new admin queries

**Files:**
- Modify: `lib/queries/admin.ts`
- Modify: `lib/__tests__/queries_admin.test.ts`

### Background

The existing `lib/queries/admin.ts` exports functions like `getHistoricalCarKm(db, currentYear)` that return `CarYearKm[]`. We add three similar functions. The test file `lib/__tests__/queries_admin.test.ts` uses `makeDb()` which runs all migrations on an in-memory DB.

---

- [ ] **Step 1: Add three interfaces to `lib/queries/admin.ts`**

Add after the existing `CarPriceHistory` interface (around line 194):

```typescript
export interface CarRollingFuel {
  car_id: number;
  fuel_per_km: number; // 0 if no km in window
}

export interface CarOwnerSplit {
  car_id: number;
  year: number;
  owner_km: number;
  non_owner_km: number;
}

export interface CarYearExpenses {
  car_id: number;
  year: number;
  amount: number;
}
```

---

- [ ] **Step 2: Add `getRollingFuelPerKm` to `lib/queries/admin.ts`**

Add after `getPriceHistory`:

```typescript
export function getRollingFuelPerKm(db: Database.Database): CarRollingFuel[] {
  return db
    .prepare(
      `
    WITH fuel AS (
      SELECT car_id, COALESCE(SUM(amount), 0.0) AS fuel_amount
      FROM fuel_fillups
      WHERE date >= date('now', '-365 days')
      GROUP BY car_id
    ),
    km AS (
      SELECT car_id, COALESCE(SUM(km), 0) AS trip_km
      FROM trips
      WHERE date >= date('now', '-365 days')
      GROUP BY car_id
    )
    SELECT
      c.id AS car_id,
      CASE WHEN COALESCE(k.trip_km, 0) > 0
        THEN COALESCE(f.fuel_amount, 0.0) / k.trip_km
        ELSE 0.0
      END AS fuel_per_km
    FROM cars c
    LEFT JOIN fuel f ON f.car_id = c.id
    LEFT JOIN km k ON k.car_id = c.id
  `
    )
    .all() as CarRollingFuel[];
}
```

---

- [ ] **Step 3: Add `getHistoricalOwnerSplit` to `lib/queries/admin.ts`**

Add after `getRollingFuelPerKm`:

```typescript
export function getHistoricalOwnerSplit(
  db: Database.Database,
  currentYear: number
): CarOwnerSplit[] {
  return db
    .prepare(
      `
    SELECT
      t.car_id,
      CAST(strftime('%Y', t.date) AS INTEGER) AS year,
      COALESCE(SUM(CASE WHEN p.name = c.owner_name THEN t.km ELSE 0 END), 0) AS owner_km,
      COALESCE(SUM(CASE WHEN p.name != c.owner_name OR c.owner_name IS NULL THEN t.km ELSE 0 END), 0) AS non_owner_km
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    WHERE CAST(strftime('%Y', t.date) AS INTEGER) BETWEEN ? AND ?
    GROUP BY t.car_id, year
    ORDER BY t.car_id, year
  `
    )
    .all(currentYear - 5, currentYear - 1) as CarOwnerSplit[];
}
```

---

- [ ] **Step 4: Add `getHistoricalExpenses` to `lib/queries/admin.ts`**

Add after `getHistoricalOwnerSplit`:

```typescript
export function getHistoricalExpenses(
  db: Database.Database,
  currentYear: number
): CarYearExpenses[] {
  return db
    .prepare(
      `
    SELECT
      car_id,
      CAST(strftime('%Y', date) AS INTEGER) AS year,
      COALESCE(SUM(amount), 0) AS amount
    FROM expenses
    WHERE CAST(strftime('%Y', date) AS INTEGER) BETWEEN ? AND ?
    GROUP BY car_id, year
    ORDER BY car_id, year
  `
    )
    .all(currentYear - 5, currentYear - 1) as CarYearExpenses[];
}
```

---

- [ ] **Step 5: Write failing tests in `lib/__tests__/queries_admin.test.ts`**

Add a new `describe` block at the end of the file (after the last `describe`):

```typescript
import {
  getRollingFuelPerKm,
  getHistoricalOwnerSplit,
  getHistoricalExpenses,
} from "../queries/admin";
// (add these to the existing import at the top of the file instead)
```

Update the existing import at the top to include the three new functions, then add:

```typescript
describe("getRollingFuelPerKm", () => {
  it("returns 0 when no data in the last 365 days", () => {
    const db = makeDb();
    insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.2, brand: null, color: null });
    const result = getRollingFuelPerKm(db);
    const cid = (db.prepare("SELECT id FROM cars WHERE short='CA'").get() as any).id;
    const row = result.find((r) => r.car_id === cid);
    expect(row?.fuel_per_km ?? 0).toBe(0);
  });

  it("computes fuel/km from rolling 12-month window", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.2, brand: null, color: null });
    // Use a recent date (within 365 days)
    const today = new Date().toISOString().slice(0, 10);
    insertTrip(db, { person_id: pid, car_id: cid, date: today, start_odometer: 0, end_odometer: 200, location: null });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: today, amount: 30, liters: 20, odometer: null, receipt: null, location: null });
    const result = getRollingFuelPerKm(db);
    const row = result.find((r) => r.car_id === cid);
    // 30 / 200 = 0.15
    expect(row?.fuel_per_km).toBeCloseTo(0.15, 4);
  });
});

describe("getHistoricalOwnerSplit", () => {
  it("returns empty array when no trips in window", () => {
    const db = makeDb();
    expect(getHistoricalOwnerSplit(db, 2060)).toEqual([]);
  });

  it("splits km correctly between owner and non-owner", () => {
    const db = makeDb();
    const owner = insertPerson(db, { ...basePerson, name: "Alice" });
    const other = insertPerson(db, { ...basePerson, name: "Bob" });
    const cid = insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.2, brand: null, color: null, owner_name: "Alice" });
    insertTrip(db, { person_id: owner, car_id: cid, date: "2022-06-01", start_odometer: 0, end_odometer: 100, location: null });
    insertTrip(db, { person_id: other, car_id: cid, date: "2022-06-02", start_odometer: 100, end_odometer: 250, location: null });
    const result = getHistoricalOwnerSplit(db, 2026);
    const row = result.find((r) => r.car_id === cid && r.year === 2022);
    expect(row?.owner_km).toBe(100);
    expect(row?.non_owner_km).toBe(150);
  });
});

describe("getHistoricalExpenses", () => {
  it("returns empty array when no expenses in window", () => {
    const db = makeDb();
    expect(getHistoricalExpenses(db, 2060)).toEqual([]);
  });

  it("sums expenses per car per year", () => {
    const db = makeDb();
    const pid = insertPerson(db, { ...basePerson, name: "Alice" });
    const cid = insertCar(db, { short: "CA", name: "Car A", price_per_km: 0.2, brand: null, color: null });
    insertExpense(db, { person_id: pid, car_id: cid, date: "2022-03-01", amount: 300, description: "Insurance" });
    insertExpense(db, { person_id: pid, car_id: cid, date: "2022-09-01", amount: 150, description: "Tax" });
    const result = getHistoricalExpenses(db, 2026);
    const row = result.find((r) => r.car_id === cid && r.year === 2022);
    expect(row?.amount).toBe(450);
  });
});
```

---

- [ ] **Step 6: Run tests — expect failures**

```bash
npm test
```

Expected: the 5 new test cases fail with "getRollingFuelPerKm is not a function" (or similar import error).

---

- [ ] **Step 7: Run tests again — expect all pass**

After adding the functions in Steps 2–4:

```bash
npm test
```

Expected: all tests pass.

---

- [ ] **Step 8: Commit**

```bash
git add lib/queries/admin.ts lib/__tests__/queries_admin.test.ts
git commit -m "feat(admin): add rolling fuel/km, owner split, and historical expenses queries"
```

---

## Task 2: Extend AdminSummary + API route

**Files:**
- Modify: `app/admin/_shared.tsx`
- Modify: `app/api/admin/summary/route.ts`

### Background

`AdminSummary` is the TypeScript interface for the `/api/admin/summary` JSON response. It lives in `app/admin/_shared.tsx`. The API handler is at `app/api/admin/summary/route.ts`.

---

- [ ] **Step 1: Extend `AdminSummary` in `app/admin/_shared.tsx`**

Update the existing import at the top of `_shared.tsx`:

```typescript
import type {
  CarPnL,
  KmGap,
  ZeroKmTrip,
  MonthlyCarKm,
  PersonContribution,
  CarYearKm,
  CarPriceHistory,
  CarRollingFuel,
  CarOwnerSplit,
  CarYearExpenses,
} from "@/lib/queries/admin";
```

Then update the `AdminSummary` interface:

```typescript
export interface AdminSummary {
  carPnL: CarPnL[];
  settlement: DashboardRow[];
  kmGaps: KmGap[];
  zeroKmTrips: ZeroKmTrip[];
  monthlyCarKm: MonthlyCarKm[];
  personContributions: PersonContribution[];
  historicalCarKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
  rollingFuelPerKm: CarRollingFuel[];
  historicalOwnerSplit: CarOwnerSplit[];
  historicalExpenses: CarYearExpenses[];
}
```

---

- [ ] **Step 2: Update the API route**

In `app/api/admin/summary/route.ts`, update the import:

```typescript
import {
  getCarPnL,
  getKmGaps,
  getZeroKmTrips,
  getMonthlyCarKm,
  getPersonContributions,
  getHistoricalCarKm,
  getPriceHistory,
  getRollingFuelPerKm,
  getHistoricalOwnerSplit,
  getHistoricalExpenses,
} from "@/lib/queries/admin";
```

And update the return value:

```typescript
return {
  carPnL: getCarPnL(db, year),
  settlement: getDashboard(db, year),
  kmGaps: getKmGaps(db),
  zeroKmTrips: getZeroKmTrips(db),
  monthlyCarKm: getMonthlyCarKm(db, year),
  personContributions: getPersonContributions(db, year),
  historicalCarKm: getHistoricalCarKm(db, year),
  priceHistory: getPriceHistory(db),
  rollingFuelPerKm: getRollingFuelPerKm(db),
  historicalOwnerSplit: getHistoricalOwnerSplit(db, year),
  historicalExpenses: getHistoricalExpenses(db, year),
};
```

---

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 4: Commit**

```bash
git add app/admin/_shared.tsx app/api/admin/summary/route.ts
git commit -m "feat(admin): expose rollingFuelPerKm, historicalOwnerSplit, historicalExpenses in summary"
```

---

## Task 3: Add i18n keys

**Files:**
- Modify: `lib/i18n/messages/nl.ts`
- Modify: `lib/i18n/messages/en.ts`

### Background

The i18n messages are plain TypeScript objects. New keys must be added to both files simultaneously or TypeScript will fail (the type is inferred from `nl.ts` and `en.ts` must match). The `useT` hook provides typed translation via these keys.

---

- [ ] **Step 1: Add keys to `lib/i18n/messages/nl.ts`**

After the `"breakeven.*"` section, add a new `// Cost coverage screen` section:

```typescript
  // Cost coverage screen
  "coverage.title": "Kostendekking",
  "coverage.zone.red": "Verlies per rit",
  "coverage.zone.orange": "Kosten niet gedekt",
  "coverage.zone.light_green": "Kosten gedekt",
  "coverage.zone.dark_green": "Brandstof ook gedekt",
  "coverage.slider.fuel_per_km": "Brandstof / km",
  "coverage.slider.total_km": "Totale km / jaar",
  "coverage.slider.pct_others": "% anderen",
  "coverage.slider.expenses": "Verwachte kosten",
  "coverage.slider.price": "Prijs / km",
  "coverage.default_12m": "gem. 12 mnd",
  "coverage.default_5y": "gem. 5 jaar",
  "coverage.default_current": "huidig",
  "coverage.projection.title": "Prognose",
  "coverage.projection.others_contribution": "Bijdrage anderen",
  "coverage.projection.expenses": "Te dekken kosten",
  "coverage.projection.owner_fuel": "Eigen brandstof",
  "coverage.projection.net": "Netto eigenaar",
  "coverage.save": "Prijs opslaan voor {year}",
  "coverage.ytd": "Huidig jaar · {months} maanden",
```

---

- [ ] **Step 2: Add matching keys to `lib/i18n/messages/en.ts`**

```typescript
  // Cost coverage screen
  "coverage.title": "Cost coverage",
  "coverage.zone.red": "Loss per trip",
  "coverage.zone.orange": "Costs not covered",
  "coverage.zone.light_green": "Costs covered",
  "coverage.zone.dark_green": "Fuel also covered",
  "coverage.slider.fuel_per_km": "Fuel / km",
  "coverage.slider.total_km": "Total km / year",
  "coverage.slider.pct_others": "% others",
  "coverage.slider.expenses": "Expected costs",
  "coverage.slider.price": "Price / km",
  "coverage.default_12m": "12-month avg",
  "coverage.default_5y": "5-year avg",
  "coverage.default_current": "current",
  "coverage.projection.title": "Projection",
  "coverage.projection.others_contribution": "Others' contribution",
  "coverage.projection.expenses": "Costs to cover",
  "coverage.projection.owner_fuel": "Own fuel",
  "coverage.projection.net": "Owner net",
  "coverage.save": "Save price for {year}",
  "coverage.ytd": "This year · {months} months",
```

---

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors (both files must have identical key sets).

---

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git commit -m "feat(i18n): add coverage screen translation keys"
```

---

## Task 4: CostCoverageScreen component

**Files:**
- Create: `components/cost-coverage-screen.tsx`

### Background

This is the main new component. It replaces both `BreakEvenCard` and `RateAssistant` in the owner view. It is a read-write component: the owner can adjust 5 sliders and save the price/km back to the car.

The paper theme colors for the four zones are:
- RED: `paper.accent` (`#B5341A` — the red)
- ORANGE: `paper.amber` (`#D97706`)
- LIGHT GREEN: `paper.green` with 50% opacity
- DARK GREEN: `paper.green` (`#3D6A4A`)

`paper`, `fontMono`, `fontSerif`, `fmtMoney` are all from `@/lib/paper-theme`.

The `Row` and `Card` components are from `@/app/admin/_shared`.

`useUpdateCar` is from `@/hooks/use-cars`. `useQueryClient` from `@tanstack/react-query`. `toast` from `sonner`.

---

- [ ] **Step 1: Create `components/cost-coverage-screen.tsx`** with the full implementation:

```typescript
"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-cars";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Row } from "@/app/admin/_shared";
import type { CarPnL, CarYearKm, CarOwnerSplit, CarYearExpenses, CarRollingFuel } from "@/lib/queries/admin";
import type { Car } from "@/types";

export interface CostCoverageScreenProps {
  car: CarPnL;
  fullCar: Car | undefined;
  historicalKm: CarYearKm[];
  ownerSplit: CarOwnerSplit[];
  historicalExpenses: CarYearExpenses[];
  rollingFuelPerKm: number; // 0 = no data
  year: number;
}

// ── Zone bar ──────────────────────────────────────────────────

function ZoneBar({
  fuelThreshold,
  expenseThreshold,
  fuelCoverThreshold,
  currentPrice,
}: {
  fuelThreshold: number;
  expenseThreshold: number;
  fuelCoverThreshold: number;
  currentPrice: number;
}) {
  const maxPrice = Math.max(fuelCoverThreshold * 1.4, currentPrice * 1.2, 0.01);

  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maxPrice) * 100)).toFixed(1)}%`;
  const markerLeft = pct(currentPrice);

  const zone1W = pct(fuelThreshold);
  const zone2W = pct(Math.max(0, expenseThreshold - fuelThreshold));
  const zone3W = pct(Math.max(0, fuelCoverThreshold - expenseThreshold));
  const zone4W = pct(Math.max(0, maxPrice - fuelCoverThreshold));

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Colour bar */}
      <div style={{ position: "relative", height: 14, display: "flex", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ width: zone1W, background: paper.accent }} />
        <div style={{ width: zone2W, background: paper.amber }} />
        <div style={{ width: zone3W, background: paper.green, opacity: 0.55 }} />
        <div style={{ width: zone4W, background: paper.green }} />
        {/* Marker */}
        <div style={{ position: "absolute", top: -3, left: markerLeft, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 2, height: 20, background: paper.ink }} />
          <div style={{ fontFamily: fontMono, fontSize: 7, fontWeight: 700, color: paper.ink, whiteSpace: "nowrap", marginTop: 2 }}>
            € {currentPrice.toFixed(2)}
          </div>
        </div>
      </div>
      {/* Threshold labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 7, color: paper.inkMute, letterSpacing: 0.5 }}>
        <span>0</span>
        <span>€{fuelThreshold.toFixed(2)} brandstof</span>
        <span>€{expenseThreshold.toFixed(2)} kosten</span>
        <span>€{fuelCoverThreshold.toFixed(2)} brandstof+</span>
      </div>
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 0.8, marginBottom: 3 }}>
        <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <span style={{ color: paper.inkDim }}>{hint}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: paper.ink, marginBottom: 2 }}
      />
      <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, textAlign: "center", color: paper.ink }}>
        {format(value)}
      </div>
    </div>
  );
}

// ── Zone label ────────────────────────────────────────────────

type Zone = "red" | "orange" | "light_green" | "dark_green";

function zoneColor(zone: Zone): string {
  if (zone === "red") return paper.accent;
  if (zone === "orange") return paper.amber;
  return paper.green;
}

function zoneKey(zone: Zone): "coverage.zone.red" | "coverage.zone.orange" | "coverage.zone.light_green" | "coverage.zone.dark_green" {
  return `coverage.zone.${zone}` as ReturnType<typeof zoneKey>;
}

// ── Main component ────────────────────────────────────────────

export function CostCoverageScreen({
  car,
  fullCar,
  historicalKm,
  ownerSplit,
  historicalExpenses,
  rollingFuelPerKm,
  year,
}: CostCoverageScreenProps) {
  const t = useT();
  const qc = useQueryClient();
  const updateCar = useUpdateCar();

  // ── Compute historical defaults ───────────────────────────

  const avgHistKm =
    historicalKm.length > 0
      ? Math.round(historicalKm.reduce((s, h) => s + h.km, 0) / historicalKm.length)
      : 0;

  const avgOthersPct =
    ownerSplit.length > 0
      ? ownerSplit.reduce((s, h) => {
          const total = h.owner_km + h.non_owner_km;
          return s + (total > 0 ? h.non_owner_km / total : 0.65);
        }, 0) / ownerSplit.length
      : 0.65;

  const avgExpenses =
    historicalExpenses.length > 0
      ? Math.round(historicalExpenses.reduce((s, e) => s + e.amount, 0) / historicalExpenses.length)
      : 0;

  const ytdFuelPerKm = car.trip_km > 0 ? car.fuel_amount / car.trip_km : 0;
  const defaultFuelPerKm = rollingFuelPerKm > 0 ? rollingFuelPerKm : ytdFuelPerKm;

  // ── Slider state ──────────────────────────────────────────

  const [fuelPerKm, setFuelPerKm] = useState(defaultFuelPerKm || 0.12);
  const [totalKm, setTotalKm] = useState(
    car.expected_km ?? (avgHistKm || car.prev_year_trip_km || 14000)
  );
  const [pctOthers, setPctOthers] = useState(Math.round(avgOthersPct * 100) / 100);
  const [expectedExpenses, setExpectedExpenses] = useState(
    avgExpenses || car.expense_amount || 0
  );
  const [pricePerKm, setPricePerKm] = useState(car.car_price_per_km);

  // ── Derived projections ───────────────────────────────────

  const nonOwnerKm = totalKm * pctOthers;
  const ownerKm = totalKm * (1 - pctOthers);
  const markupPerKm = pricePerKm - fuelPerKm;
  const nonOwnerMarkup = markupPerKm * nonOwnerKm;
  const ownerFuelCost = fuelPerKm * ownerKm;

  const fuelThreshold = fuelPerKm;
  const safeNonOwnerKm = Math.max(1, nonOwnerKm);
  const expenseThreshold = fuelPerKm + expectedExpenses / safeNonOwnerKm;
  const fuelCoverThreshold =
    fuelPerKm + (expectedExpenses + ownerFuelCost) / safeNonOwnerKm;

  const zone: Zone =
    markupPerKm < 0
      ? "red"
      : nonOwnerMarkup < expectedExpenses
        ? "orange"
        : nonOwnerMarkup < expectedExpenses + ownerFuelCost
          ? "light_green"
          : "dark_green";

  const ownerNet = nonOwnerMarkup - expectedExpenses - ownerFuelCost;
  const color = zoneColor(zone);

  // ── YTD snapshot values ───────────────────────────────────

  const currentMonth = new Date().getMonth() + 1;
  const ytdNet = car.net;

  // ── Save ─────────────────────────────────────────────────

  function handleSave() {
    if (!fullCar) return;
    updateCar.mutate(
      { ...fullCar, price_per_km: pricePerKm, expected_km: Math.round(totalKm) } as Car & { id: number },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          qc.invalidateQueries({ queryKey: ["cars"] });
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{car.car_name}</div>
          <div style={{ fontFamily: fontMono, fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color, border: `2px solid ${color}`, padding: "3px 8px", textTransform: "uppercase", transform: "rotate(-2deg)" }}>
            {t(zoneKey(zone))}
          </div>
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, textTransform: "uppercase" }}>
          {t("coverage.ytd", { months: currentMonth })}
        </div>

        {/* YTD actuals */}
        <div style={{ marginTop: 10, borderTop: `1px dashed ${paper.paperDark}`, paddingTop: 10 }}>
          <Row label={t("breakeven.revenue")} value={fmtMoney(car.trip_revenue)} color={paper.green} />
          <Row label={t("breakeven.expenses")} value={fmtMoney(car.variable_total)} />
          <Row
            label={t("breakeven.net")}
            value={fmtMoney(Math.abs(ytdNet))}
            color={ytdNet >= 0 ? paper.green : paper.accent}
            big
          />
        </div>
      </Card>

      {/* Zone bar */}
      <Card>
        <div style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: paper.inkDim, fontWeight: 700, marginBottom: 12 }}>
          {t("coverage.title")}
        </div>
        <ZoneBar
          fuelThreshold={fuelThreshold}
          expenseThreshold={expenseThreshold}
          fuelCoverThreshold={fuelCoverThreshold}
          currentPrice={pricePerKm}
        />

        {/* 5 sliders */}
        <SliderRow
          label={t("coverage.slider.fuel_per_km")}
          hint={rollingFuelPerKm > 0 ? t("coverage.default_12m") : "—"}
          value={fuelPerKm}
          min={0.01}
          max={0.5}
          step={0.005}
          format={(v) => `€ ${v.toFixed(3)}/km`}
          onChange={setFuelPerKm}
        />
        <SliderRow
          label={t("coverage.slider.total_km")}
          hint={avgHistKm > 0 ? t("coverage.default_5y") : "—"}
          value={totalKm}
          min={500}
          max={Math.max(50000, totalKm * 1.5)}
          step={100}
          format={(v) => v.toLocaleString("nl-BE") + " km"}
          onChange={setTotalKm}
        />
        <SliderRow
          label={t("coverage.slider.pct_others")}
          hint={ownerSplit.length > 0 ? t("coverage.default_5y") : "—"}
          value={pctOthers}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setPctOthers}
        />
        <SliderRow
          label={t("coverage.slider.expenses")}
          hint={avgExpenses > 0 ? t("coverage.default_5y") : "—"}
          value={expectedExpenses}
          min={0}
          max={Math.max(5000, expectedExpenses * 2)}
          step={50}
          format={(v) => fmtMoney(v)}
          onChange={setExpectedExpenses}
        />
        <SliderRow
          label={t("coverage.slider.price")}
          hint={t("coverage.default_current")}
          value={pricePerKm}
          min={0.01}
          max={Math.max(1.0, pricePerKm * 2)}
          step={0.005}
          format={(v) => `€ ${v.toFixed(3)}/km`}
          onChange={setPricePerKm}
        />

        {/* Projection summary */}
        <div style={{ background: paper.paperDeep, padding: "12px", marginTop: 8, marginBottom: 12 }}>
          <div style={{ fontFamily: fontMono, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: paper.inkDim, fontWeight: 700, marginBottom: 8 }}>
            {t("coverage.projection.title")}
          </div>
          <Row label={t("coverage.projection.others_contribution")} value={fmtMoney(nonOwnerMarkup)} color={nonOwnerMarkup >= 0 ? paper.green : paper.accent} />
          <Row label={t("coverage.projection.expenses")} value={fmtMoney(expectedExpenses)} />
          <Row label={t("coverage.projection.owner_fuel")} value={fmtMoney(ownerFuelCost)} />
          <div style={{ height: 0, borderTop: `1px dashed ${paper.inkMute}`, margin: "6px 0" }} />
          <Row
            label={t("coverage.projection.net")}
            value={fmtMoney(Math.abs(ownerNet))}
            color={ownerNet >= 0 ? paper.green : paper.accent}
            big
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!fullCar || updateCar.isPending}
          style={{
            width: "100%",
            padding: "11px",
            background: paper.ink,
            color: paper.paper,
            border: "none",
            cursor: !fullCar || updateCar.isPending ? "default" : "pointer",
            opacity: !fullCar || updateCar.isPending ? 0.6 : 1,
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {updateCar.isPending ? "…" : t("coverage.save", { year })}
        </button>
      </Card>
    </div>
  );
}
```

---

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 3: Commit**

```bash
git add components/cost-coverage-screen.tsx
git commit -m "feat(owner): add CostCoverageScreen with 5-slider what-if forecaster and 4-zone bar"
```

---

## Task 5: Wire into page + cleanup

**Files:**
- Modify: `app/admin/cars/page.tsx`
- Delete: `components/rate-assistant.tsx`

### Background

`OwnerFleet` in `page.tsx` currently has two URL-driven views: `detail` (BreakEvenCard) and `rate` (RateAssistant). We collapse these into a single `detail` view using `CostCoverageScreen`. The `OwnerCarTile` has two buttons (break-even + rate); we collapse them into one.

The `OwnerScreen` type currently is:
```typescript
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number };
```

After this task it becomes:
```typescript
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number };
```

---

- [ ] **Step 1: Update imports in `app/admin/cars/page.tsx`**

Replace:
```typescript
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";
```

With:
```typescript
import { BreakEvenCard } from "@/components/break-even-card";
import { CostCoverageScreen } from "@/components/cost-coverage-screen";
```

(`BreakEvenCard` stays because `FleetTiles` still uses it for the admin view.)

---

- [ ] **Step 2: Simplify the `OwnerScreen` type**

Replace:
```typescript
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number };
```

With:
```typescript
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number };
```

---

- [ ] **Step 3: Update `OwnerCarTile` props — remove `onRate`**

Replace the `OwnerCarTile` function signature and its call-site props:

Function signature — change from:
```typescript
function OwnerCarTile({
  car, pnlData, onDetail, onRate, editOpen, onEditOpen, onEditClose,
}: {
  car: Car;
  pnlData: ReturnType<typeof beMetrics> | null;
  onDetail: () => void;
  onRate: () => void;
  editOpen: boolean;
  onEditOpen: () => void;
  onEditClose: () => void;
})
```

To:
```typescript
function OwnerCarTile({
  car, pnlData, onDetail, editOpen, onEditOpen, onEditClose,
}: {
  car: Car;
  pnlData: ReturnType<typeof beMetrics> | null;
  onDetail: () => void;
  editOpen: boolean;
  onEditOpen: () => void;
  onEditClose: () => void;
})
```

---

- [ ] **Step 4: Remove the rate button from `OwnerCarTile`'s JSX**

Inside `OwnerCarTile`, find the two-button row (currently a flex row with "Break-even →" and "Rate assistant" buttons). Replace with a single button:

Replace:
```tsx
{pnlData && (
  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
    <button
      onClick={onDetail}
      style={{ flex: 1, padding: "10px 8px", background: paper.ink, color: paper.paper, border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}
    >
      {t("fleet.see_breakeven")} →
    </button>
    <button
      onClick={onRate}
      style={{ flex: 1, padding: "10px 8px", background: "transparent", color: paper.ink, border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}
    >
      {t("rate.open")}
    </button>
  </div>
)}
```

With:
```tsx
{pnlData && (
  <button
    onClick={onDetail}
    style={{ width: "100%", marginBottom: 16, padding: "10px 8px", background: paper.ink, color: paper.paper, border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}
  >
    {t("coverage.title")} →
  </button>
)}
```

---

- [ ] **Step 5: Update `OwnerFleet` — remove `goToRate`, simplify screen derivation**

In `OwnerFleet`, find the URL-derived screen logic. Remove the `rate` branch:

Replace:
```typescript
const screen: OwnerScreen =
  viewParam === "detail" && screenCarId ? { view: "detail", carId: screenCarId } :
  viewParam === "rate" && screenCarId ? { view: "rate", carId: screenCarId } :
  { view: "fleet" };
```

With:
```typescript
const screen: OwnerScreen =
  viewParam === "detail" && screenCarId ? { view: "detail", carId: screenCarId } :
  { view: "fleet" };
```

Remove the `goToRate` function entirely:
```typescript
// DELETE this function:
const goToRate = (id: number) => {
  const p = new URLSearchParams();
  p.set("view", "rate");
  p.set("car", String(id));
  if (year !== currentYear) p.set("year", String(year));
  router.push(`${pathname}?${p.toString()}`, { scroll: false });
};
```

---

- [ ] **Step 6: Update the data bindings in `OwnerFleet`**

After the existing summary destructuring, add the three new fields:

```typescript
const allPnL = summary?.carPnL ?? [];
const contributions = summary?.personContributions ?? [];
const historicalKm = summary?.historicalCarKm ?? [];
const priceHistory = summary?.priceHistory ?? [];
const rollingFuel = summary?.rollingFuelPerKm ?? [];
const ownerSplitAll = summary?.historicalOwnerSplit ?? [];
const historicalExpensesAll = summary?.historicalExpenses ?? [];
```

(Remove `monthlyKm` if it's only referenced in the now-deleted rate/detail views and not used elsewhere in OwnerFleet. Check the existing usages first.)

---

- [ ] **Step 7: Replace the `detail` view in `OwnerFleet`**

Find the `if (screen.view === "detail")` branch and replace the `BreakEvenCard` with `CostCoverageScreen`:

Replace:
```tsx
if (screen.view === "detail") {
  const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
  if (!pnlCar) return null;
  return (
    <div style={{ padding: "16px" }}>
      {yearSelector}
      <button onClick={() => router.back()} style={backBtnStyle}>
        ← {t("owner.back_fleet")}
      </button>
      <BreakEvenCard
        car={pnlCar}
        fullCar={carMap.get(screen.carId)}
        contributions={contributions.filter((c) => c.car_id === screen.carId)}
        historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
        priceHistory={priceHistory.filter((h) => h.car_id === screen.carId)}
        year={year}
        onRateOpen={() => goToRate(screen.carId)}
      />
    </div>
  );
}
```

With:
```tsx
if (screen.view === "detail") {
  const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
  if (!pnlCar) return null;
  const carRollingFuel = rollingFuel.find((r) => r.car_id === screen.carId);
  return (
    <div style={{ padding: "16px" }}>
      {yearSelector}
      <button onClick={() => router.back()} style={backBtnStyle}>
        ← {t("owner.back_fleet")}
      </button>
      <CostCoverageScreen
        car={pnlCar}
        fullCar={carMap.get(screen.carId)}
        historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
        ownerSplit={ownerSplitAll.filter((s) => s.car_id === screen.carId)}
        historicalExpenses={historicalExpensesAll.filter((e) => e.car_id === screen.carId)}
        rollingFuelPerKm={carRollingFuel?.fuel_per_km ?? 0}
        year={year}
      />
    </div>
  );
}
```

---

- [ ] **Step 8: Remove the `rate` view branch from `OwnerFleet`**

Delete the entire `if (screen.view === "rate") { ... }` block (it now handled by the merged detail view).

---

- [ ] **Step 9: Update the `renderTile` call to remove `onRate`**

Find where `OwnerCarTile` is rendered (search for `onRate={() => goToRate`). Update to remove `onRate`:

Replace:
```tsx
onDetail={() => goToDetail(car.id)}
onRate={() => goToRate(car.id)}
```

With:
```tsx
onDetail={() => goToDetail(car.id)}
```

---

- [ ] **Step 10: Delete `components/rate-assistant.tsx`**

```bash
git rm components/rate-assistant.tsx
```

---

- [ ] **Step 11: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

- [ ] **Step 12: Run tests**

```bash
npm test
```

Expected: all tests pass.

---

- [ ] **Step 13: Commit**

```bash
git add app/admin/cars/page.tsx
git commit -m "feat(owner): replace break-even+rate views with merged CostCoverageScreen; remove rate-assistant"
```

---

## Self-review

**1. Spec coverage:**
- ✅ Rolling 12-month fuel/km (Task 1 + 2)
- ✅ 5-year avg total km (uses existing `historicalKm`, defaulted in Task 4)
- ✅ 5-year avg % others (Task 1 `getHistoricalOwnerSplit`, Task 4 default)
- ✅ 5-year avg expenses (Task 1 `getHistoricalExpenses`, Task 4 default)
- ✅ Price/km slider (Task 4)
- ✅ 4-zone tier bar with live thresholds (Task 4)
- ✅ Projection row (non-owner contribution / expenses / owner fuel / net) (Task 4)
- ✅ Save commits price_per_km + expected_km (Task 4)
- ✅ Merged screen (rate view removed) (Task 5)
- ✅ YTD actuals visible alongside forecast (Task 4)

**2. Placeholder scan:** None found.

**3. Type consistency:**
- `CarRollingFuel`, `CarOwnerSplit`, `CarYearExpenses` defined in Task 1 and used consistently in Tasks 2, 3, 4.
- `CostCoverageScreenProps` uses all three new types from `lib/queries/admin`.
- `rollingFuelPerKm` is a plain `number` (extracted from `CarRollingFuel[]` at call site in Task 5).
