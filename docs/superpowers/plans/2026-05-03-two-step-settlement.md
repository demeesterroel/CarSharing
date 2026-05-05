# Two-Step Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the settlement from 3 steps (members→coop, coop→owners, owners↔owners) to 2 steps by routing cross-owner car usage through the co-op in Step 1, eliminating Step 3 entirely.

**Architecture:** Cross-owner trips (owner A driving owner B's car) are treated identically to regular member trips in Step 1 — they pay trip fees and receive fuel/expense reimbursements via the co-op. The co-op then pays each car owner a larger N(c) in Step 2 that already includes cross-owner contributions. The display is reorganised from "grouped by type then car" to "grouped by car then participant", with owner own-trips shown as €0 rows for transparency. Net financial outcomes for all parties are mathematically identical to the 3-step model.

**Tech Stack:** Next.js App Router, better-sqlite3, React Query, Vitest, TypeScript

**Context for implementer:**
- Worktree: `.worktrees/feature/issue-88` (branch `feature/issue-88`)
- Run tests: `npx vitest run` (319 passing before you start)
- Run type-check: `npx tsc --noEmit`
- Key files: `types/index.ts`, `lib/queries/settlement.ts`, `lib/__tests__/settlement.test.ts`, `app/admin/settlement/page.tsx`, `lib/i18n/messages/nl.ts`, `lib/i18n/messages/en.ts`
- Paper theme helpers (already imported in page): `paper`, `fontMono`, `fontSerif`, `fmtMoney` from `@/lib/paper-theme`

**Mathematical equivalence proof (2018 Ethel/JF example):**
- Old: Alice (cross-owner) drives Bob's Car B: €30 trip → Step 3 Alice→Bob €30
- New: Alice pays co-op €30 in Step 1; co-op pays Bob €30 more in Step 2
- N_new(CarB) = 120 + 30 = 150; Alice.net = 150(s2) − 30(s1_cross) = 120 (unchanged); Bob.net = 150 (unchanged)

---

## File Structure

**Modified:**
- `types/index.ts` — add `CarParticipantRow`, `CarSettlement`; update `SettlementResult`, `MemberStatement`, `Transfer`
- `lib/queries/settlement.ts` — restructure N computation, add `car_settlements`, replace Step 3 with cross-owner Step 1
- `lib/__tests__/settlement.test.ts` — update existing tests, add `car_settlements` tests
- `app/admin/settlement/page.tsx` — redesign display: car-centric Step 1, simplified Step 2, remove Step 3
- `lib/i18n/messages/nl.ts` — new keys for cross-owner and own-trip labels
- `lib/i18n/messages/en.ts` — same

---

## Task 1: Update types

**Files:**
- Modify: `types/index.ts:191-252`

- [ ] **Step 1: Add `CarParticipantRow` and `CarSettlement` types after `CrossOwnerBalance`**

In `types/index.ts`, replace the block starting at `export interface CrossOwnerBalance` through `export interface SettlementResult`:

```typescript
// REMOVE CrossOwnerBalance — replaced by CarParticipantRow in car_settlements

export interface CarParticipantRow {
  person_name: string;
  row_type: "member" | "cross_owner" | "own"; // own = owner's own trips, shown €0
  trip_km: number;
  trip_amount: number; // 0 for row_type "own"
  fuel_liters: number;
  fuel_amount: number;
  expense_amount: number;
  balance: number; // trip_amount − fuel_amount − expense_amount; 0 for "own"
  fuel_settled_count: number;
  fuel_settled_liters: number;
  expense_settled_count: number;
  expense_settled_amount: number;
}

export interface CarSettlement {
  car_name: string;
  car_short: string;
  owner_name: string;
  owner_from: string;
  owner_to: string | null;
  rows: CarParticipantRow[]; // sorted: members (alpha) → cross_owners (alpha) → own
  total_balance: number; // N_new(c) = what co-op pays owner in Step 2
}

export interface CarEraBalance {
  car_name: string;
  car_short: string;
  owner_name: string;
  owner_from: string;
  owner_to: string | null;
  trip_amount: number;
  trip_km: number;
  fuel_amount: number;
  fuel_liters: number;
  expense_amount: number;
  balance: number;
  n_c_star?: number;
  member_contributions?: CarMemberContribution[];
  fuel_settled_count?: number;
  fuel_settled_liters?: number;
  expense_settled_count?: number;
  expense_settled_amount?: number;
}

export interface MemberStatement {
  person_id: number;
  person_name: string;
  is_owner: boolean;
  s1?: number;      // non-owner: net balance with co-op (negative = owes)
  s2?: number;      // owner: co-op payout (N_new for all owned cars)
  s1_cross?: number; // owner: cross-owner balance in Step 1 (negative = owes co-op)
  net?: number;     // owner: s2 + s1_cross
  car_eras: CarEraBalance[];
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
  step: 1 | 2; // 3 eliminated
  label: string;
}

export interface SettlementResult {
  year: number;
  frozen: boolean;
  settled_at: string | null;
  settled_by: string | null;
  members: MemberStatement[];
  car_settlements: CarSettlement[];
  transfers: Transfer[];
  verify_ok: boolean;
}
```

- [ ] **Step 2: Run type-check to catch any cascading errors**

```bash
(cd /path/to/worktree && npx tsc --noEmit 2>&1 | head -40)
```

Expected: errors in `settlement.ts` and `page.tsx` (they reference removed fields). Note them — they will be fixed in subsequent tasks.

- [ ] **Step 3: Commit types**

```bash
git add types/index.ts
git commit -m "refactor(types): replace CrossOwnerBalance with CarParticipantRow/CarSettlement; Transfer.step 1|2 only"
```

---

## Task 2: Update settlement tests (TDD — write failing tests first)

**Files:**
- Modify: `lib/__tests__/settlement.test.ts`

Current test `seed` has Alice (owner of CarA) driving CarB (Bob's car) for €30 / 150 km. No own-car trips for Alice on CarA. We'll add Alice's own trip on CarA to test the `own` row.

- [ ] **Step 1: Update `seed` function to add Alice own-car trip**

Replace the `seed` function in `lib/__tests__/settlement.test.ts`:

```typescript
function seed(db: Database.Database) {
  db.exec(`
    INSERT INTO people (id, name, active) VALUES
      (1, 'Alice', 1),
      (2, 'Bob',   1),
      (3, 'Carol', 1),
      (4, 'Dave',  1);
  `);
  db.exec(`
    INSERT INTO cars (id, short, name, price_per_km, owner_name, owner_from, active)
    VALUES
      (1, 'CA', 'Car A', 0.2, 'Alice', '2020-01-01', 1),
      (2, 'CB', 'Car B', 0.2, 'Bob',   '2020-01-01', 1);
  `);
  const addTrip = db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  );
  addTrip.run(3, 1, "2025-06-01", 0,   500, 500, 100); // carol drives CarA: €100
  addTrip.run(4, 1, "2025-06-02", 500, 750, 250,  50); // dave drives CarA:  €50
  addTrip.run(3, 2, "2025-06-03", 0,   400, 400,  80); // carol drives CarB: €80
  addTrip.run(4, 2, "2025-06-04", 400, 600, 200,  40); // dave drives CarB:  €40
  addTrip.run(1, 2, "2025-06-05", 600, 750, 150,  30); // alice drives CarB (cross-owner): €30
  addTrip.run(1, 1, "2025-06-06", 750, 900, 150,  30); // alice drives CarA (own): €30 — shown as €0 in settlement
}
```

- [ ] **Step 2: Update existing tests for new 2-step math**

Replace all tests in the `describe("getSettlement")` block:

```typescript
describe("getSettlement", () => {
  it("N_new(c) includes cross-owner trips", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    // CarA: carol(100) + dave(50) = 150; alice own trip excluded
    expect(alice.car_eras[0].n_c_star).toBe(150);
    // CarB: carol(80) + dave(40) + alice-cross(30) = 150
    expect(bob.car_eras[0].n_c_star).toBe(150);
  });

  it("S₁ for non-owners unchanged", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    const dave = result.members.find((m) => m.person_name === "Dave")!;
    expect(carol.s1).toBe(-180); // -(100+80)
    expect(dave.s1).toBe(-90);   // -(50+40)
  });

  it("S₂ for owners uses N_new", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.s2).toBe(150); // N_new(CarA) = 150
    expect(bob.s2).toBe(150);   // N_new(CarB) = 150 (includes alice cross €30)
  });

  it("s1_cross for owners: their balance for using other cars", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.s1_cross).toBe(-30); // alice drove CarB: owes €30 to co-op
    expect(bob.s1_cross).toBe(0);     // bob drove no other cars
  });

  it("net for owners: s2 + s1_cross", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.net).toBe(120); // 150 + (-30)
    expect(bob.net).toBe(150);   // 150 + 0
  });

  it("verify_ok: co-op in = co-op out", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    expect(result.verify_ok).toBe(true);
  });

  it("step 1 transfers include non-owners and cross-owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step1 = result.transfers.filter((t) => t.step === 1);
    const carol = step1.find((t) => t.from === "Carol");
    const dave  = step1.find((t) => t.from === "Dave");
    const alice = step1.find((t) => t.from === "Alice");
    expect(carol?.amount).toBe(180);
    expect(carol?.to).toBe("co-op");
    expect(dave?.amount).toBe(90);
    expect(alice?.amount).toBe(30); // cross-owner now in Step 1
    expect(alice?.to).toBe("co-op");
  });

  it("step 2 transfers use N_new amounts", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step2 = result.transfers.filter((t) => t.step === 2);
    const toAlice = step2.find((t) => t.to === "Alice");
    const toBob   = step2.find((t) => t.to === "Bob");
    expect(toAlice?.amount).toBe(150);
    expect(toBob?.amount).toBe(150); // was 120, now includes alice cross €30
  });

  it("no step 3 transfers", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    expect(result.transfers.filter((t) => t.step === (3 as never))).toHaveLength(0);
  });

  it("car_settlements: CarB has member, cross_owner, and own rows", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carB = result.car_settlements.find((c) => c.car_short === "CB")!;
    expect(carB.total_balance).toBe(150);
    const members    = carB.rows.filter((r) => r.row_type === "member");
    const crossOwner = carB.rows.filter((r) => r.row_type === "cross_owner");
    const own        = carB.rows.filter((r) => r.row_type === "own");
    expect(members.map((r) => r.person_name).sort()).toEqual(["Carol", "Dave"]);
    expect(crossOwner).toHaveLength(1);
    expect(crossOwner[0].person_name).toBe("Alice");
    expect(crossOwner[0].trip_amount).toBe(30);
    expect(crossOwner[0].balance).toBe(30);
    expect(own).toHaveLength(0); // Bob has no own trips recorded
  });

  it("car_settlements: CarA has member rows and own row for Alice", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carA = result.car_settlements.find((c) => c.car_short === "CA")!;
    expect(carA.total_balance).toBe(150);
    const own = carA.rows.filter((r) => r.row_type === "own");
    expect(own).toHaveLength(1);
    expect(own[0].person_name).toBe("Alice");
    expect(own[0].trip_km).toBe(150);
    expect(own[0].trip_amount).toBe(0); // own trips = €0 in settlement
    expect(own[0].balance).toBe(0);
  });

  it("credits non-owner fuel payment against their balance and N_new", () => {
    const db = makeDb();
    seed(db);
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(3, 1, "2025-07-01", 20, 20, 1.0);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    expect(carol.s1).toBe(-160); // was -180, +20 fuel credit
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    expect(alice.s2).toBe(130);  // N_new(CarA): 150 - 20 = 130
  });

  it("returns empty result when no car eras exist for the year", () => {
    const db = makeDb();
    const result = getSettlement(db, 2025);
    expect(result.members).toHaveLength(0);
    expect(result.car_settlements).toHaveLength(0);
    expect(result.verify_ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — expect failures**

```bash
(cd /path/to/worktree && npx vitest run lib/__tests__/settlement.test.ts 2>&1 | tail -30)
```

Expected: multiple failures (N_new, s1_cross, car_settlements not yet implemented). Confirm failures before proceeding.

- [ ] **Step 4: Commit failing tests**

```bash
git add lib/__tests__/settlement.test.ts
git commit -m "test(settlement): update tests for 2-step model; add car_settlements tests (failing)"
```

---

## Task 3: Rewrite settlement query

**Files:**
- Modify: `lib/queries/settlement.ts`

The math changes:
- **N_new(c)** = Σ all people except car's own owner: `(trip − fuel − exp)` (was: only non-owners)
- **S2(o)** = Σ N_new for owned cars (unchanged formula, larger values)
- **s1_cross(o)** = Σ b(o, other_cars) = what owner owes/receives for driving other cars
- **net(o)** = s2 + s1_cross
- **car_settlements** = new car-centric data structure
- **transfers**: Step 1 includes cross-owners; Step 2 uses N_new; no Step 3
- **verify_ok**: Σ S1 + Σ s1_cross + Σ S2 ≈ 0

- [ ] **Step 1: Replace `getSettlement` with 2-step version**

Replace the entire `getSettlement` function body in `lib/queries/settlement.ts` (keep helper functions and imports, keep `lockSettlement`/`unlockSettlement`):

```typescript
export function getSettlement(db: Database.Database, year: number): SettlementResult {
  const yearStr = String(year);

  // 1. Car-eras active in this year
  const carEras = db
    .prepare(
      `SELECT id, name, short, owner_name, owner_from,
              COALESCE(owner_to, '9999-12-31') AS owner_to
       FROM cars
       WHERE owner_name IS NOT NULL
         AND owner_from IS NOT NULL
         AND owner_from <= ?
         AND COALESCE(owner_to, '9999-12-31') >= ?`
    )
    .all(`${yearStr}-12-31`, `${yearStr}-01-01`) as CarEraRow[];

  // 2. Frozen status
  const lock = db
    .prepare("SELECT settled_at, settled_by FROM settlements WHERE year = ?")
    .get(year) as SettlementRow | undefined;

  if (carEras.length === 0) {
    return {
      year,
      frozen: !!lock,
      settled_at: lock?.settled_at ?? null,
      settled_by: lock?.settled_by ?? null,
      members: [],
      car_settlements: [],
      transfers: [],
      verify_ok: true,
    };
  }

  // 3. All people
  const people = db.prepare("SELECT id, name FROM people ORDER BY name").all() as PersonRow[];

  // 4. Classify owners vs non-owners
  const ownerNames = new Set(carEras.map((e) => e.owner_name));
  const owners = people.filter((p) => ownerNames.has(p.name));
  const nonOwners = people.filter((p) => !ownerNames.has(p.name));

  // 5. Query all trips/fuel/expenses for owned cars in year, within era bounds
  const tripRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.amount), 0) AS amount
       FROM trips t JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const tripKmRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.km), 0) AS amount
       FROM trips t JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelRows = db
    .prepare(
      `SELECT f.person_id, f.car_id,
              COALESCE(SUM(CASE WHEN f.settled_outside = 0 THEN f.amount ELSE 0 END), 0) AS amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelLiterRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COALESCE(SUM(f.liters), 0) AS amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelSettledRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COUNT(*) as cnt, COALESCE(SUM(f.liters), 0) as amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
         AND f.settled_outside = 1
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expSettledRows = db
    .prepare(
      `SELECT e.person_id, e.car_id, COUNT(*) as cnt, COALESCE(SUM(e.amount), 0) as amount
       FROM expenses e JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from AND (c.owner_to IS NULL OR e.date <= c.owner_to)
         AND e.settled_outside = 1
       GROUP BY e.person_id, e.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expRows = db
    .prepare(
      `SELECT e.person_id, e.car_id,
              COALESCE(SUM(CASE WHEN e.settled_outside = 0 THEN e.amount ELSE 0 END), 0) AS amount
       FROM expenses e JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from AND (c.owner_to IS NULL OR e.date <= c.owner_to)
       GROUP BY e.person_id, e.car_id`
    )
    .all(yearStr) as AmountRow[];

  const trips       = buildMap(tripRows);
  const tripKm      = buildMap(tripKmRows);
  const fuel        = buildMap(fuelRows);
  const fuelLiters  = buildMap(fuelLiterRows);
  const exp         = buildMap(expRows);
  const fuelSettled = buildSettledMap(fuelSettledRows);
  const expSettled  = buildSettledMap(expSettledRows);

  // 6. Car-era lookup by owner
  const carsByOwner = new Map<string, CarEraRow[]>();
  for (const era of carEras) {
    if (!carsByOwner.has(era.owner_name)) carsByOwner.set(era.owner_name, []);
    carsByOwner.get(era.owner_name)!.push(era);
  }

  // Helper: build a CarParticipantRow for a given person × car
  function makeRow(
    p: PersonRow,
    era: CarEraRow,
    rowType: "member" | "cross_owner" | "own"
  ): CarParticipantRow {
    const tripAmt = rowType === "own" ? 0 : get(trips, p.id, era.id);
    const fuelAmt = rowType === "own" ? 0 : get(fuel, p.id, era.id);
    const expAmt  = rowType === "own" ? 0 : get(exp, p.id, era.id);
    const fs = fuelSettled.get(p.id)?.get(era.id);
    const es = expSettled.get(p.id)?.get(era.id);
    return {
      person_name: p.name,
      row_type: rowType,
      trip_km: get(tripKm, p.id, era.id),
      trip_amount: tripAmt,
      fuel_liters: rowType === "own" ? 0 : get(fuelLiters, p.id, era.id),
      fuel_amount: fuelAmt,
      expense_amount: expAmt,
      balance: round2(tripAmt - fuelAmt - expAmt),
      fuel_settled_count: fs?.cnt ?? 0,
      fuel_settled_liters: fs?.amount ?? 0,
      expense_settled_count: es?.cnt ?? 0,
      expense_settled_amount: es?.amount ?? 0,
    };
  }

  // 7. N_new(c) = Σ all people EXCEPT car's own owner: (trip − fuel − exp)
  //    Includes cross-owners (other car owners who used this car)
  const N = new Map<number, number>();
  for (const era of carEras) {
    let n = 0;
    for (const p of people) {
      if (p.name === era.owner_name) continue; // own-car trips are free (vestzak/broekzak)
      n += get(trips, p.id, era.id) - get(fuel, p.id, era.id) - get(exp, p.id, era.id);
    }
    N.set(era.id, round2(n));
  }

  // 8. S₁(p) for non-owners: Σ b(p, c*) across all cars (negative = owes co-op)
  const S1 = new Map<number, number>();
  for (const p of nonOwners) {
    let s1 = 0;
    for (const era of carEras) {
      s1 += -get(trips, p.id, era.id) + get(fuel, p.id, era.id) + get(exp, p.id, era.id);
    }
    S1.set(p.id, round2(s1));
  }

  // 9. S₂(o) = Σ N_new(cars owned by o)
  const S2 = new Map<string, number>();
  for (const owner of owners) {
    const ownedCars = carsByOwner.get(owner.name) ?? [];
    S2.set(owner.name, round2(ownedCars.reduce((s, c) => s + (N.get(c.id) ?? 0), 0)));
  }

  // 10. s1_cross(o) = balance of owner o for using OTHER owners' cars (negative = owes co-op)
  const S1Cross = new Map<string, number>();
  for (const owner of owners) {
    let s1c = 0;
    for (const era of carEras) {
      if (era.owner_name === owner.name) continue; // skip own car
      s1c += -get(trips, owner.id, era.id) + get(fuel, owner.id, era.id) + get(exp, owner.id, era.id);
    }
    S1Cross.set(owner.name, round2(s1c));
  }

  // 11. Build car_settlements (car-centric view for display)
  const car_settlements: import("@/types").CarSettlement[] = carEras.map((era) => {
    const rows: import("@/types").CarParticipantRow[] = [];

    // Regular members
    for (const p of nonOwners) {
      const tripAmt = get(trips, p.id, era.id);
      const fuelAmt = get(fuel, p.id, era.id);
      const expAmt  = get(exp, p.id, era.id);
      if (tripAmt === 0 && fuelAmt === 0 && expAmt === 0) continue;
      rows.push(makeRow(p, era, "member"));
    }

    // Cross-owners (other car owners using this car)
    for (const o of owners) {
      if (o.name === era.owner_name) continue;
      const tripAmt = get(trips, o.id, era.id);
      const fuelAmt = get(fuel, o.id, era.id);
      const expAmt  = get(exp, o.id, era.id);
      if (tripAmt === 0 && fuelAmt === 0 && expAmt === 0) continue;
      rows.push(makeRow(o, era, "cross_owner"));
    }

    // Owner's own trips (shown as €0 — vestzak/broekzak)
    const ownerPerson = people.find((p) => p.name === era.owner_name);
    if (ownerPerson && get(tripKm, ownerPerson.id, era.id) > 0) {
      rows.push(makeRow(ownerPerson, era, "own"));
    }

    // Sort: members (alpha) → cross_owners (alpha) → own
    const order = { member: 0, cross_owner: 1, own: 2 } as const;
    rows.sort((a, b) =>
      order[a.row_type] !== order[b.row_type]
        ? order[a.row_type] - order[b.row_type]
        : a.person_name.localeCompare(b.person_name)
    );

    return {
      car_name: era.name,
      car_short: era.short,
      owner_name: era.owner_name,
      owner_from: era.owner_from,
      owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
      rows,
      total_balance: N.get(era.id) ?? 0,
    };
  });

  // 12. Build member statements (kept for payment summary in page)
  const members: import("@/types").MemberStatement[] = [];

  for (const p of nonOwners) {
    const s1 = S1.get(p.id) ?? 0;
    const car_eras: import("@/types").CarEraBalance[] = carEras
      .map((era) => {
        const tripAmt = get(trips, p.id, era.id);
        const fuelAmt = get(fuel, p.id, era.id);
        const expAmt  = get(exp, p.id, era.id);
        const fs = fuelSettled.get(p.id)?.get(era.id);
        const es = expSettled.get(p.id)?.get(era.id);
        return {
          car_name: era.name, car_short: era.short,
          owner_name: era.owner_name, owner_from: era.owner_from,
          owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
          trip_amount: tripAmt, trip_km: get(tripKm, p.id, era.id),
          fuel_amount: fuelAmt, fuel_liters: get(fuelLiters, p.id, era.id),
          expense_amount: expAmt,
          balance: round2(-tripAmt + fuelAmt + expAmt),
          fuel_settled_count: fs?.cnt, fuel_settled_liters: fs?.amount,
          expense_settled_count: es?.cnt, expense_settled_amount: es?.amount,
        };
      })
      .filter((e) => e.trip_amount > 0 || e.fuel_amount > 0 || e.expense_amount > 0);

    if (car_eras.length > 0) {
      members.push({ person_id: p.id, person_name: p.name, is_owner: false, s1, car_eras });
    }
  }

  for (const o of owners) {
    const s2       = S2.get(o.name) ?? 0;
    const s1_cross = S1Cross.get(o.name) ?? 0;
    const ownedCars = carsByOwner.get(o.name) ?? [];
    const car_eras: import("@/types").CarEraBalance[] = ownedCars.map((era) => ({
      car_name: era.name, car_short: era.short,
      owner_name: era.owner_name, owner_from: era.owner_from,
      owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
      trip_amount: 0, trip_km: 0, fuel_amount: 0, fuel_liters: 0, expense_amount: 0,
      balance: N.get(era.id) ?? 0,
      n_c_star: N.get(era.id) ?? 0,
      member_contributions: [...nonOwners, ...owners.filter((j) => j.name !== o.name)]
        .map((p) => {
          const fs = fuelSettled.get(p.id)?.get(era.id);
          const es = expSettled.get(p.id)?.get(era.id);
          return {
            person_name: p.name,
            trip_km: get(tripKm, p.id, era.id),
            fuel_liters: get(fuelLiters, p.id, era.id),
            expense_amount: get(exp, p.id, era.id),
            contribution: round2(get(trips, p.id, era.id) - get(fuel, p.id, era.id) - get(exp, p.id, era.id)),
            fuel_settled_count: fs?.cnt ?? 0,
            fuel_settled_liters: fs?.amount ?? 0,
            expense_settled_count: es?.cnt ?? 0,
            expense_settled_amount: es?.amount ?? 0,
          };
        })
        .filter((c) => Math.abs(c.contribution) > 0.005)
        .sort((a, b) => b.contribution - a.contribution),
    }));

    members.push({
      person_id: o.id, person_name: o.name, is_owner: true,
      s2, s1_cross, net: round2(s2 + s1_cross), car_eras,
    });
  }

  // Sort: owners first (net desc), then non-owners (s1 desc)
  members.sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const av = a.is_owner ? (a.net ?? 0) : (a.s1 ?? 0);
    const bv = b.is_owner ? (b.net ?? 0) : (b.s1 ?? 0);
    return bv - av;
  });

  // 13. Build transfers — Step 1 (non-owners + cross-owners) and Step 2 (owners)
  const transfers: import("@/types").Transfer[] = [];

  for (const p of nonOwners) {
    const s1 = S1.get(p.id) ?? 0;
    if (Math.abs(s1) < 0.005) continue;
    if (s1 < 0) {
      transfers.push({ from: p.name, to: "co-op", amount: round2(-s1), step: 1, label: `${p.name} → co-op` });
    } else {
      transfers.push({ from: "co-op", to: p.name, amount: s1, step: 1, label: `co-op → ${p.name}` });
    }
  }

  for (const o of owners) {
    const s1c = S1Cross.get(o.name) ?? 0;
    if (Math.abs(s1c) < 0.005) continue;
    if (s1c < 0) {
      transfers.push({ from: o.name, to: "co-op", amount: round2(-s1c), step: 1, label: `${o.name} → co-op` });
    } else {
      transfers.push({ from: "co-op", to: o.name, amount: s1c, step: 1, label: `co-op → ${o.name}` });
    }
  }

  for (const o of owners) {
    const s2 = S2.get(o.name) ?? 0;
    if (Math.abs(s2) < 0.005) continue;
    transfers.push({ from: "co-op", to: o.name, amount: s2, step: 2, label: `co-op → ${o.name}` });
  }

  // 14. Verify: Σ S1 + Σ S1Cross + Σ S2 ≈ 0
  const sumS1     = [...S1.values()].reduce((s, v) => s + v, 0);
  const sumS1c    = [...S1Cross.values()].reduce((s, v) => s + v, 0);
  const sumS2     = [...S2.values()].reduce((s, v) => s + v, 0);
  const verify_ok = Math.abs(sumS1 + sumS1c + sumS2) < 0.05;

  return {
    year, frozen: !!lock,
    settled_at: lock?.settled_at ?? null,
    settled_by: lock?.settled_by ?? null,
    members, car_settlements, transfers, verify_ok,
  };
}
```

- [ ] **Step 2: Run settlement tests**

```bash
(cd /path/to/worktree && npx vitest run lib/__tests__/settlement.test.ts 2>&1 | tail -20)
```

Expected: all settlement tests pass.

- [ ] **Step 3: Run full test suite**

```bash
(cd /path/to/worktree && npx vitest run 2>&1 | tail -10)
```

Expected: 319+ tests pass (count may increase due to new tests).

- [ ] **Step 4: Run type-check**

```bash
(cd /path/to/worktree && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30)
```

Expected: errors only in `page.tsx` (it still references `cross_owner_balances`, `x`, step 3). Note them.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/settlement.ts
git commit -m "feat(settlement): 2-step model — N_new includes cross-owners, eliminates Step 3"
```

---

## Task 4: Add i18n keys

**Files:**
- Modify: `lib/i18n/messages/nl.ts`
- Modify: `lib/i18n/messages/en.ts`

- [ ] **Step 1: Add keys to `nl.ts`**

Find the `"settlement."` section in `lib/i18n/messages/nl.ts` and add:

```typescript
"settlement.row_cross_owner": "mede-eigenaar",
"settlement.row_own": "eigen ritten (€0)",
"settlement.own_trips_note": "Eigen ritten zijn niet aangerekend (vestzak/broekzak).",
"settlement.step1_label": "Leden → Coöp",
"settlement.step2_label": "Coöp → Eigenaars",
```

- [ ] **Step 2: Add keys to `en.ts`**

Find the `"settlement."` section in `lib/i18n/messages/en.ts` and add:

```typescript
"settlement.row_cross_owner": "cross-owner",
"settlement.row_own": "own trips (€0)",
"settlement.own_trips_note": "Own trips are not charged (owner's pocket).",
"settlement.step1_label": "Members → Co-op",
"settlement.step2_label": "Co-op → Owners",
```

- [ ] **Step 3: Run i18n test**

```bash
(cd /path/to/worktree && npx vitest run lib/__tests__/i18n.test.ts 2>&1 | tail -10)
```

Expected: PASS (i18n test checks that nl and en have identical keys).

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git commit -m "feat(i18n): add settlement 2-step display keys"
```

---

## Task 5: Redesign settlement page display

**Files:**
- Modify: `app/admin/settlement/page.tsx`

The page currently has three main sections rendered inside the main component: Step 1 (members, grouped by trip/fuel/expense type then car), Step 2 (owners, car contributions), Step 3 (cross-owner). Replace with:
- Step 1: per-car tables using `car_settlements`
- Step 2: simplified owner payout list
- No Step 3

The `generateSettlementMd` function and `YearPicker`, `DownloadButton`, `SectionLabel`, `SettledNote` helper components stay.

The `NonOwnerCard` and `OwnerCard` components that currently render the per-member view should be replaced by a new `CarSettlementCard` component.

- [ ] **Step 1: Add `CarSettlementCard` component**

Add this component to `page.tsx` after the `SettledNote` component:

```tsx
import type { CarSettlement, CarParticipantRow } from "@/types";

function CarSettlementCard({ cs }: { cs: CarSettlement }) {
  const t = useT();
  const rowStyle = (row: CarParticipantRow): React.CSSProperties => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontFamily: fontMono,
    fontSize: row.row_type === "own" ? 9 : 11,
    color: row.row_type === "own" ? paper.inkDim : row.row_type === "cross_owner" ? paper.blue : paper.ink,
    marginBottom: 4,
    paddingLeft: row.row_type === "own" ? 8 : 0,
    fontStyle: row.row_type === "own" ? "italic" : "normal",
  });

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Car header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, fontWeight: 700, color: paper.ink }}>
          {cs.car_short} — {cs.car_name}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, alignSelf: "center" }}>
          {cs.owner_name}
        </div>
      </div>

      {/* Participant rows */}
      {cs.rows.map((row, i) => {
        const detail: string[] = [];
        if (row.trip_km > 0) detail.push(`+${row.trip_km} km`);
        if (row.fuel_liters > 0.05) {
          const star = row.fuel_settled_liters > 0.05 ? "(*)" : "";
          detail.push(`−${row.fuel_liters.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L${star}`);
        }
        if (row.expense_amount > 0.005) {
          const star = row.expense_settled_amount > 0.005 ? "(*)" : "";
          detail.push(`− ${fmtMoney(row.expense_amount)}${star}`);
        }
        const detailStr = detail.length > 0 ? ` (${detail.join(", ")})` : "";
        const label =
          row.row_type === "own"
            ? `${row.person_name} — ${t("settlement.row_own")}`
            : row.row_type === "cross_owner"
            ? `${row.person_name} — ${t("settlement.row_cross_owner")}`
            : row.person_name;

        return (
          <div key={i}>
            <div style={rowStyle(row)}>
              <span>
                {label}
                <span style={{ color: paper.inkDim, fontSize: 9 }}>{detailStr}</span>
              </span>
              {row.row_type !== "own" && (
                <span style={{ color: row.balance >= 0 ? paper.green : paper.accent }}>
                  {row.balance >= 0 ? "+" : "−"}{fmtMoney(Math.abs(row.balance))}
                </span>
              )}
            </div>
            <SettledNote
              fuelCount={row.fuel_settled_count}
              fuelLiters={row.fuel_settled_liters}
              expCount={row.expense_settled_count}
              expAmt={row.expense_settled_amount}
            />
          </div>
        );
      })}

      {/* Total row */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: fontMono, fontSize: 11, fontWeight: 700,
        borderTop: `1px solid ${paper.paperDark}`, paddingTop: 6, marginTop: 4,
        color: paper.ink,
      }}>
        <span>Totaal</span>
        <span style={{ color: cs.total_balance >= 0 ? paper.green : paper.accent }}>
          {cs.total_balance >= 0 ? "+" : "−"}{fmtMoney(Math.abs(cs.total_balance))}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace Step 1, Step 2, Step 3 rendering in the main page component**

Find the section in the main `SettlementPage` component that renders Steps 1/2/3 (currently renders `NonOwnerCard` and `OwnerCard` lists). Replace with:

```tsx
{/* Step 1 — Members → Co-op, grouped by car */}
<div style={{ marginBottom: 24 }}>
  <SectionLabel>{t("settlement.step1_label")}</SectionLabel>
  {data.car_settlements.map((cs, i) => (
    <CarSettlementCard key={i} cs={cs} />
  ))}
</div>

{/* Step 2 — Co-op → Owners */}
<div style={{ marginBottom: 24 }}>
  <SectionLabel>{t("settlement.step2_label")}</SectionLabel>
  {data.members
    .filter((m) => m.is_owner)
    .map((m, i) => (
      <div key={i} style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: fontMono, fontSize: 11, marginBottom: 6, color: paper.ink,
      }}>
        <span>{m.person_name}</span>
        <span style={{ color: (m.s2 ?? 0) >= 0 ? paper.green : paper.accent }}>
          {(m.s2 ?? 0) >= 0 ? "+" : "−"}{fmtMoney(Math.abs(m.s2 ?? 0))}
        </span>
      </div>
    ))}
</div>
```

- [ ] **Step 3: Update `generateSettlementMd` for 2-step structure**

Find `generateSettlementMd` in `page.tsx` and replace with:

```typescript
function generateSettlementMd(data: import("@/types").SettlementResult, year: number): string {
  const lines: string[] = [`# Afrekening ${year}\n`];
  const fmt = (n: number) => n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n: number) => (n >= 0 ? `+€ ${fmt(n)}` : `−€ ${fmt(-n)}`);
  const fmtL = (l: number) => l.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Step 1 — per car
  const step1Total = data.car_settlements.reduce((s, c) => s + c.total_balance, 0);
  lines.push(`## Stap 1 — Leden → Coöp  (${sign(step1Total)})\n`);
  for (const cs of data.car_settlements) {
    lines.push(`### ${cs.car_name} (${cs.owner_name})  ${sign(cs.total_balance)}\n`);
    for (const row of cs.rows) {
      if (row.row_type === "own") {
        lines.push(`- **${row.person_name}** _(eigen ritten — €0)_`);
        lines.push(`  - Ritten: ${row.trip_km} km · €0,00`);
        continue;
      }
      const label = row.row_type === "cross_owner" ? `${row.person_name} _(mede-eigenaar)_` : `**${row.person_name}**`;
      lines.push(`- ${label}`);
      if (row.trip_km > 0)        lines.push(`  - Ritten: ${row.trip_km} km · € ${fmt(row.trip_amount)}`);
      if (row.fuel_liters > 0.05) lines.push(`  - Brandstof: ${fmtL(row.fuel_liters)} L · € ${fmt(row.fuel_amount)}`);
      if (row.expense_amount > 0.005) lines.push(`  - Kosten: € ${fmt(row.expense_amount)}`);
      lines.push(`  - Saldo: ${sign(row.balance)}`);
      if ((row.fuel_settled_liters ?? 0) > 0.05) {
        lines.push(`  - _(*)_ ${row.fuel_settled_count} tankbeurt(en) (${fmtL(row.fuel_settled_liters)} L) buiten de app verrekend`);
      }
      if ((row.expense_settled_amount ?? 0) > 0.005) {
        lines.push(`  - _(*)_ ${row.expense_settled_count} kost(en) (€ ${fmt(row.expense_settled_amount)}) buiten de app verrekend`);
      }
    }
    lines.push("");
  }

  // Step 2 — co-op → owners
  const owners = data.members.filter((m) => m.is_owner).sort((a, b) => a.person_name.localeCompare(b.person_name));
  const step2Total = owners.reduce((s, m) => s + (m.s2 ?? 0), 0);
  lines.push(`## Stap 2 — Coöp → Eigenaars  (${sign(step2Total)})\n`);
  for (const m of owners) {
    lines.push(`### ${m.person_name}  ${sign(m.s2 ?? 0)}\n`);
    const cs = data.car_settlements.filter((c) => c.owner_name === m.person_name);
    for (const c of cs) {
      lines.push(`- **${c.car_short} — ${c.car_name}**  ${sign(c.total_balance)}`);
      for (const row of c.rows.filter((r) => r.row_type !== "own")) {
        const contrib = row.balance;
        const detail: string[] = [`+${row.trip_km} km`];
        if (row.fuel_liters > 0.05) detail.push(`-${fmtL(row.fuel_liters)} L`);
        if (row.expense_amount > 0.005) detail.push(`-€ ${fmt(row.expense_amount)}`);
        lines.push(`  - ${row.person_name} (${detail.join(", ")}): ${sign(contrib)}`);
      }
    }
    lines.push(`- **Saldo via coöp: ${sign(m.s2 ?? 0)}**\n`);
  }

  // Payment summary
  lines.push(`## Betalingsoverzicht\n`);
  for (const tr of data.transfers) {
    lines.push(`- **Stap ${tr.step}** ${tr.from} → ${tr.to}: € ${fmt(tr.amount)}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Fix any TypeScript errors in page.tsx**

```bash
(cd /path/to/worktree && npx tsc --noEmit 2>&1 | grep "page.tsx" | head -20)
```

Fix any remaining errors (likely: remove references to `cross_owner_balances`, `x`, `step: 3` in the old components/render functions that are now unused). Delete the old `NonOwnerCard` and `OwnerCard` component functions if they are no longer referenced.

- [ ] **Step 5: Run full test suite**

```bash
(cd /path/to/worktree && npx vitest run 2>&1 | tail -10)
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/settlement/page.tsx
git commit -m "feat(settlement): redesign page to 2-step car-centric view; remove Step 3"
```

---

## Task 6: Visual verification

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server**

```bash
(cd /path/to/worktree && npm run dev -- --port 3001) &
sleep 4 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

Expected: 307

- [ ] **Step 2: Check settlement page for 2018**

Open: `http://localhost:3001/admin/settlement?year=2018`

Verify:
- Step 1 shows cards per car (Ethel, Jean-Francois)
- Ethel card has: Inez, Leila, Monica, Stefaan, Steven, Susanna, Wim as members; Roeland as cross-owner; Malvina own row (€0)
- JF card has: Leila, Stefaan, Steven, Susanna, Wim as members; Malvina as cross-owner; Roeland own row (€0)
- Step 2 shows: Malvina +€100,06; Roeland +€833,67
- No Step 3 section

- [ ] **Step 3: Check payment summary**

Verify payment summary:
- Step 1: all non-owner transfers + Malvina→co-op (cross-owner) + Roeland→co-op (cross-owner)
- Step 2: co-op→Malvina, co-op→Roeland
- No "Malvina → Roeland" line (was Step 3)

- [ ] **Step 4: Download MD and verify format matches expected structure**

Click ↓ button. Verify: Stap 1 per car, Stap 2 per owner, Betalingsoverzicht, no Stap 3.

- [ ] **Step 5: Commit if any fixes needed, then final commit**

```bash
git add -A
git commit -m "fix(settlement): visual verification corrections"
```

---

## Self-Review

**Spec coverage:**
- ✅ Cross-owner trips in Step 1 via co-op
- ✅ Owner own-trip rows shown as €0 with km
- ✅ Display grouped by car then participant type
- ✅ "Settled outside" notes inline per participant per car
- ✅ Step 3 eliminated
- ✅ Math produces identical net results (proved in plan header)
- ✅ MD export updated
- ✅ i18n keys added

**Type consistency:**
- `CarParticipantRow.row_type` used consistently: `"member" | "cross_owner" | "own"`
- `CarSettlement.rows` and `CarSettlement.total_balance` match query output
- `Transfer.step: 1 | 2` — no references to step 3 remain after page.tsx cleanup
- `MemberStatement.s1_cross` replaces `x` for owners — used in verify formula

**Placeholder scan:** None found.
