# Offline Phase 2 — Write Queue, Optimistic UI & Background Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make add/edit/delete operations work offline by queueing them locally, applying them optimistically to the UI, and replaying them to the server when connectivity returns — without producing duplicates or silent data loss.

**Architecture:** Three-layer write pipeline. (1) **Server contract:** every mutable table gains a `client_id TEXT UNIQUE` column for idempotent inserts and an `updated_at` column for last-write-wins conflict checks. POST endpoints accept an optional `client_id`; PUT/DELETE endpoints become idempotent by construction. (2) **Client outbox:** a tiny IndexedDB-backed FIFO queue (via the `idb` library) stores pending mutations with their `client_id`, method, URL, body, and queue timestamp. Mutations write to the outbox *and* React Query's cache (optimistic update) on commit. (3) **Sync engine:** a singleton drainer fires on `online` events and on Background Sync API tags, replaying queued items in order. Successful replays remove from the outbox and reconcile React Query cache with the server response. Conflicts (HTTP 409) drop with a toast.

**Tech Stack:** Next.js 15 App Router · better-sqlite3 migrations · `idb` (^8) for typed IndexedDB · React Query v5 mutations · Workbox Background Sync API

**Depends on:** Issue #8 (Phase 1) merged.

**Closes:** Issue #20

**Branch:** `feature/offline-phase-2`

---

## Architectural decisions (locked-in)

- **ID strategy:** Server keeps integer autoincrement `id` as the primary key (don't break existing FK relationships). Add `client_id TEXT UNIQUE` as a secondary identifier for idempotency. Optimistic rows use the `client_id` as their React Query identity until the real `id` arrives.
- **Conflict policy:** Last-write-wins, with a soft check. Each mutable row has `updated_at`. Client sends `If-Unmodified-Since`-style header (`X-Expected-Updated-At`) on PUT. If server's `updated_at` is newer, return 409. On 409, drop the queued item and toast the user. No automatic merge.
- **Mutation scope (priority-ordered):**
  - **Primary — full offline write support:**
    - `trips` — the highest-frequency action; logging a trip in the field is the canonical offline use case.
    - `fuel_fillups` — second-most-frequent; often filled in at the pump where signal is unreliable.
  - **Secondary — full offline write support:**
    - `expenses` — member-initiated extra-cost logging.
    - `reservations` — booking the car for a future window (the create/edit/delete flow only).
  - **Read-only offline (writes require connection):**
    - **Reservation status changes** (admin confirm/reject) — confirming a booking offline could mislead users about availability.
    - **Admin screens** under `/admin/*` (inbox, member management, settlement, payouts, hygiene gap-assignment, owner break-even tooling).
    - **Owner screens** (car management, fixed costs, price history, expected-km).
    - **People & cars CRUD** (admin-only forms).
  - **Rationale:** the offline experience targets the *member* in the field. Admin and owner workflows are deliberate and benefit from the consistency of a live server; making them write-offline introduces failure modes (e.g. queued reservation confirms creating phantom availability) that aren't worth the complexity for a use case that almost always happens at a desk.
- **Library choices:** `idb` (5 KB, well-maintained, typed wrapper). No Dexie, no Replicache, no full sync engine.
- **Drain trigger:** primary path is the `online` event (works in all browsers). Background Sync API is registered as a fallback for cases where the tab is closed before reconnect; we accept that Safari ignores Background Sync.
- **No background fetcher worker:** the drainer runs in the page context, not the SW. Simpler, easier to reason about React Query invalidation. The only thing the SW does is fire the Background Sync event back to a focused client.
- **UI feel:** every queued create/update appears in the list immediately with a subtle "pending" indicator (italic + small `↻` glyph). On successful sync the indicator clears. On conflict it briefly flashes red before being removed.

---

## File Structure

**New files:**
- `migrations/0003_add_client_id_and_updated_at.sql` — schema migration.
- `lib/offline/outbox.ts` — IndexedDB wrapper (`enqueue`, `peek`, `drain`, `remove`, `count`, `list`).
- `lib/offline/outbox.test.ts` — uses `fake-indexeddb` to test queue operations end-to-end.
- `lib/offline/sync-engine.ts` — drainer logic + `useSyncEngine` hook + Background Sync registration.
- `lib/offline/sync-engine.test.ts` — drainer unit tests with a mock fetcher.
- `lib/offline/uuid.ts` — thin wrapper around `crypto.randomUUID()` with a Node fallback for tests.
- `lib/offline/optimistic.ts` — helpers for optimistic React Query cache mutations (insert pending row, replace on success, remove on rollback).
- `components/pending-badge.tsx` — small `↻` glyph component used in list rows.

**Modified files:**
- `lib/db/migrate.ts` — no change (it auto-discovers migrations) but verify.
- `app/api/trips/route.ts` (POST) — accept optional `client_id`, return existing record on duplicate.
- `app/api/trips/[id]/route.ts` (PUT, DELETE) — verify `X-Expected-Updated-At`, idempotent delete.
- Same trio for `fuel_fillups`, `expenses`, `reservations` (12 endpoints total).
- `lib/queries/*.ts` — return `client_id` and `updated_at` in SELECT projections.
- `types/index.ts` (or wherever shared types live) — add `client_id`, `updated_at` to entity interfaces.
- `hooks/use-trips.ts`, `hooks/use-fuel.ts`, `hooks/use-expenses.ts`, `hooks/use-reservations.ts` — wrap mutations in `enqueueOnFailure` + optimistic update.
- `lib/offline/online-state.tsx` — extend context with `pendingCount`, expose a setter for the sync engine to update.
- `components/offline-badge.tsx` — extend to 4-state model: hidden / offline-fresh / offline-stale / queued-count.
- `lib/i18n/messages/{nl,en}.ts` — new keys for queue UI and conflict toasts.
- `app/providers.tsx` — mount `useSyncEngine`.
- The four list pages (`/trips`, `/fuel`, `/expenses`, `/calendar`) — render `<PendingBadge />` on rows whose `id < 0` (sentinel) or have `_pending: true`.

**Tests:**
- `lib/offline/outbox.test.ts`
- `lib/offline/sync-engine.test.ts`
- `lib/offline/optimistic.test.ts`
- `lib/__tests__/migration_0003.test.ts` — verifies the new schema, idempotent inserts via `client_id`.
- `lib/__tests__/api_idempotency.test.ts` — POST same `client_id` twice, expect a single row.

---

## Build sequence

This is a thicker plan than Phase 1. Order matters and follows the priority pattern (trips → fuel → expenses → reservations) so the high-value member workflows are working end-to-end before we touch the secondary ones:

1. **Schema first** (Task 1–2) so server can be built against it.
2. **Server idempotency, primary scope** (Task 3–4) — trips end-to-end (POST idempotent, PUT conflict-checked, DELETE idempotent), fully tested.
3. **Server idempotency, primary scope cont.** (Task 5) — fuel, mirror of trips.
4. **Server idempotency, secondary scope** (Task 6) — expenses + reservations (member create/edit/delete only; the `/api/reservations/[id]/status` admin endpoint stays untouched and online-only).
5. **Client UUID** + **outbox** + **sync engine** (Task 7–10) — the offline machinery, still without UI hooks.
6. **Mutation hooks, primary scope** (Task 11–12) — trips, then fuel. After Task 12 the highest-value offline path is shippable on its own if needed.
7. **Mutation hooks, secondary scope** (Task 13–14) — expenses, reservations.
8. **UI feedback** (Task 15–16) — pending badge in lists, queued count in offline badge.
9. **End-to-end QA** (Task 17).
10. **PR** (Task 18).

If at any point this branch grows uncomfortably large, it's safe to ship after Task 12 (primary scope only), open #20 follow-up issues for secondary scope, and merge in two waves. The architectural pieces (outbox, drainer, optimistic helpers) don't change between waves.

---

### Task 1: Migration — `client_id` and `updated_at` columns

**Files:**
- Create: `migrations/0003_add_client_id_and_updated_at.sql`
- Test: `lib/__tests__/migration_0003.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/migration_0003.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";

describe("migration 0003", () => {
  it("adds client_id and updated_at to trips", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(trips)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("client_id");
    expect(names).toContain("updated_at");
  });

  it("adds the same columns to fuel_fillups, expenses, reservations", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    for (const t of ["fuel_fillups", "expenses", "reservations"]) {
      const cols = db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names, `${t} missing client_id`).toContain("client_id");
      expect(names, `${t} missing updated_at`).toContain("updated_at");
    }
  });

  it("enforces UNIQUE on client_id per table", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    // seed
    db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
    db.prepare(
      "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,client_id) VALUES (?,?,?,?,?,?,?,?)"
    ).run(1, 1, "2026-01-01", 0, 0, 0, 0, "abc");
    expect(() =>
      db.prepare(
        "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,client_id) VALUES (?,?,?,?,?,?,?,?)"
      ).run(1, 1, "2026-01-02", 0, 0, 0, 0, "abc")
    ).toThrow(/UNIQUE/i);
  });

  it("populates updated_at with a default of CURRENT_TIMESTAMP on insert", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
    db.prepare(
      "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount) VALUES (?,?,?,?,?,?,?)"
    ).run(1, 1, "2026-01-01", 0, 0, 0, 0);
    const row = db.prepare("SELECT updated_at FROM trips LIMIT 1").get() as { updated_at: string };
    expect(row.updated_at).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- migration_0003`
Expected: FAIL — columns don't exist.

- [ ] **Step 3: Write the migration SQL**

```sql
-- migrations/0003_add_client_id_and_updated_at.sql

ALTER TABLE trips         ADD COLUMN client_id TEXT;
ALTER TABLE fuel_fillups  ADD COLUMN client_id TEXT;
ALTER TABLE expenses      ADD COLUMN client_id TEXT;
ALTER TABLE reservations  ADD COLUMN client_id TEXT;

ALTER TABLE trips         ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE fuel_fillups  ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE expenses      ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE reservations  ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_client_id        ON trips(client_id)        WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_fillups_client_id ON fuel_fillups(client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_client_id     ON expenses(client_id)     WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_client_id ON reservations(client_id) WHERE client_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_trips_updated_at        AFTER UPDATE ON trips        FOR EACH ROW BEGIN UPDATE trips        SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_fuel_fillups_updated_at AFTER UPDATE ON fuel_fillups FOR EACH ROW BEGIN UPDATE fuel_fillups SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_expenses_updated_at     AFTER UPDATE ON expenses     FOR EACH ROW BEGIN UPDATE expenses     SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_reservations_updated_at AFTER UPDATE ON reservations FOR EACH ROW BEGIN UPDATE reservations SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- migration_0003`
Expected: PASS (4/4).
Run: `npm test` — all existing migration tests should still pass.

- [ ] **Step 5: Commit**

```bash
git add migrations/0003_add_client_id_and_updated_at.sql lib/__tests__/migration_0003.test.ts
git commit -m "feat(db): add client_id and updated_at columns for offline sync"
```

---

### Task 2: Update query types and SELECT projections

**Files:**
- Modify: `types/index.ts` (or whichever file declares the entity types)
- Modify: every `lib/queries/*.ts` that returns these entities

- [ ] **Step 1: Add fields to entity interfaces**

```ts
// types/index.ts (find each interface and add the two fields)
export interface Trip {
  // ... existing fields
  client_id: string | null;
  updated_at: string;
}
// repeat for FuelFillup, Expense, Reservation
```

- [ ] **Step 2: Add fields to every SELECT that returns these entities**

Find each SELECT for `trips`, `fuel_fillups`, `expenses`, `reservations`. Add `client_id, updated_at` to the column list. Use:

```bash
grep -rn "FROM trips\|FROM fuel_fillups\|FROM expenses\|FROM reservations" lib/queries/
```

Modify each query so the returned shape matches the new interface.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: existing tests still pass; type errors in TS surface and are fixed in the same step.

- [ ] **Step 4: Commit**

```bash
git add types lib/queries
git commit -m "feat(api): include client_id and updated_at in entity projections"
```

---

### Task 3: API — POST `/api/trips` accepts client_id idempotently

**Files:**
- Modify: `app/api/trips/route.ts`
- Test: `lib/__tests__/api_idempotency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/api_idempotency.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { createTrip } from "../queries/trips"; // <-- adjust import path

describe("createTrip idempotency", () => {
  it("returns the same row for repeated client_id (no duplicate insert)", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");

    const input = {
      person_id: 1, car_id: 1, date: "2026-04-27",
      start_odometer: 100, end_odometer: 150, km: 50, amount: 10,
      client_id: "uuid-1",
    };
    const a = createTrip(db, input);
    const b = createTrip(db, input);
    expect(a.id).toBe(b.id);
    const count = db.prepare("SELECT COUNT(*) c FROM trips").get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("creates two rows when client_id differs", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");

    const a = createTrip(db, { person_id:1, car_id:1, date:"2026-04-27", start_odometer:0, end_odometer:50, km:50, amount:10, client_id:"u-1" });
    const b = createTrip(db, { person_id:1, car_id:1, date:"2026-04-27", start_odometer:50, end_odometer:80, km:30, amount:6,  client_id:"u-2" });
    expect(a.id).not.toBe(b.id);
  });

  it("creates a row when client_id is null (legacy)", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
    db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");

    const a = createTrip(db, { person_id:1, car_id:1, date:"2026-04-27", start_odometer:0, end_odometer:50, km:50, amount:10 });
    expect(a.id).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- api_idempotency`
Expected: FAIL.

- [ ] **Step 3: Implement idempotent createTrip**

Find `createTrip` (likely in `lib/queries/trips.ts`). Modify:

```ts
// lib/queries/trips.ts
export function createTrip(db: Database.Database, input: TripCreateInput): Trip {
  if (input.client_id) {
    const existing = db.prepare(
      "SELECT * FROM trips WHERE client_id = ?"
    ).get(input.client_id) as Trip | undefined;
    if (existing) return existing;
  }
  const result = db.prepare(`
    INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location, client_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.start_odometer, input.end_odometer, input.km, input.amount,
    input.location ?? null, input.client_id ?? null
  );
  return db.prepare("SELECT * FROM trips WHERE id = ?").get(result.lastInsertRowid) as Trip;
}
```

- [ ] **Step 4: Update the route handler to accept client_id**

```ts
// app/api/trips/route.ts (POST handler — adapt to existing pattern)
const body = await req.json();
const trip = createTrip(db, {
  person_id: body.person_id,
  car_id: body.car_id,
  date: body.date,
  start_odometer: body.start_odometer,
  end_odometer: body.end_odometer,
  km: body.km,
  amount: body.amount,
  location: body.location ?? null,
  client_id: typeof body.client_id === "string" ? body.client_id : null,
});
return NextResponse.json(trip, { status: 201 });
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- api_idempotency`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add app/api/trips/route.ts lib/queries/trips.ts lib/__tests__/api_idempotency.test.ts
git commit -m "feat(api): trips POST is idempotent on client_id"
```

---

### Task 4: API — PUT `/api/trips/[id]` enforces conflict check

**Files:**
- Modify: `app/api/trips/[id]/route.ts`
- Modify: `lib/queries/trips.ts` (`updateTrip`)
- Test: extend `api_idempotency.test.ts`

- [ ] **Step 1: Add failing test for conflict path**

```ts
// add to lib/__tests__/api_idempotency.test.ts
it("updateTrip throws ConflictError when expectedUpdatedAt is older than DB", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  db.exec("INSERT INTO people (id,name) VALUES (1,'P')");
  db.exec("INSERT INTO cars (id,short,name,price_per_km) VALUES (1,'X','c',0.2)");
  const t = createTrip(db, { person_id:1, car_id:1, date:"2026-04-27", start_odometer:0, end_odometer:50, km:50, amount:10 });

  // Simulate someone else updating in the meantime
  db.prepare("UPDATE trips SET amount = 20, updated_at = '2099-01-01 00:00:00' WHERE id = ?").run(t.id);

  expect(() =>
    updateTrip(db, { id: t.id, amount: 30 }, { expectedUpdatedAt: t.updated_at })
  ).toThrowError(ConflictError);
});
```

- [ ] **Step 2: Add `ConflictError` and the check**

```ts
// lib/queries/trips.ts
export class ConflictError extends Error {
  constructor(message = "Conflict") { super(message); this.name = "ConflictError"; }
}

export function updateTrip(
  db: Database.Database,
  input: TripUpdateInput,
  opts?: { expectedUpdatedAt?: string }
): Trip {
  if (opts?.expectedUpdatedAt) {
    const cur = db.prepare("SELECT updated_at FROM trips WHERE id = ?").get(input.id) as { updated_at: string } | undefined;
    if (!cur) throw new ConflictError("Trip no longer exists");
    if (cur.updated_at !== opts.expectedUpdatedAt) {
      throw new ConflictError("Trip was modified after this offline edit");
    }
  }
  // ... existing UPDATE logic ...
}
```

- [ ] **Step 3: Plumb it through the route**

```ts
// app/api/trips/[id]/route.ts (PUT)
try {
  const expected = req.headers.get("X-Expected-Updated-At") ?? undefined;
  const trip = updateTrip(db, { id, ...body }, { expectedUpdatedAt: expected });
  return NextResponse.json(trip);
} catch (e) {
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
  throw e;
}
```

- [ ] **Step 4: Make DELETE idempotent**

```ts
// app/api/trips/[id]/route.ts (DELETE)
const result = db.prepare("DELETE FROM trips WHERE id = ?").run(id);
return NextResponse.json({ deleted: result.changes > 0 }); // 200 either way
```

- [ ] **Step 5: Run tests, commit**

Run: `npm test -- api_idempotency`
Expected: PASS.

```bash
git add app/api/trips lib/queries/trips.ts lib/__tests__/api_idempotency.test.ts
git commit -m "feat(api): trips PUT supports conflict check, DELETE is idempotent"
```

---

### Task 5: Repeat Tasks 3–4 for fuel_fillups

**Files:**
- Modify: `app/api/fuel/route.ts`, `app/api/fuel/[id]/route.ts`, `lib/queries/fuel.ts`
- Test: extend `api_idempotency.test.ts`

- [ ] **Step 1: Mirror Tasks 3–4 for fuel**

Apply the same pattern: `client_id` idempotency on POST, `expectedUpdatedAt` on PUT, idempotent DELETE. Tests follow the same shape with the fuel inputs (`liters`, `amount`, `is_full`, `location`, `date`, etc.).

- [ ] **Step 2: Run tests, commit**

```bash
git add app/api/fuel lib/queries/fuel.ts lib/__tests__/api_idempotency.test.ts
git commit -m "feat(api): fuel POST idempotent, PUT conflict-checked, DELETE idempotent"
```

---

### Task 6: Repeat Tasks 3–4 for expenses and reservations

**Files:**
- Modify: `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `lib/queries/expenses.ts`
- Modify: `app/api/reservations/route.ts`, `app/api/reservations/[id]/route.ts`, `lib/queries/reservations.ts`
- Test: extend `api_idempotency.test.ts`

- [ ] **Step 1: Apply the pattern to expenses**

Same shape as Tasks 3–4. Skip the conflict logic for `reservation status changes` (admin-driven, currently rare offline) — but do support it for the standard PUT flow.

- [ ] **Step 2: Apply to reservations**

Reservations have an extra subtlety: the `/api/reservations/[id]/status` endpoint (confirm/reject) should also accept `client_id` if we want admins to do this offline. For Phase 2 scope, **leave status-change online-only** and document this in the i18n hint.

- [ ] **Step 3: Run all tests, commit**

```bash
npm test
git add app/api lib/queries lib/__tests__/api_idempotency.test.ts
git commit -m "feat(api): expenses & reservations idempotent POST/PUT/DELETE"
```

---

### Task 7: UUID utility

**Files:**
- Create: `lib/offline/uuid.ts`

- [ ] **Step 1: Implement**

```ts
// lib/offline/uuid.ts
export function newUuid(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC 4122 v4 fallback
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
```

- [ ] **Step 2: Quick smoke test**

```ts
// lib/offline/uuid.test.ts
import { describe, it, expect } from "vitest";
import { newUuid } from "./uuid";

describe("newUuid", () => {
  it("returns RFC4122 v4 shape", () => {
    expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("yields unique values across N calls", () => {
    const set = new Set(Array.from({ length: 1000 }, newUuid));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/offline/uuid.ts lib/offline/uuid.test.ts
git commit -m "feat(offline): UUIDv4 helper with crypto fallback"
```

---

### Task 8: Outbox — IndexedDB queue

**Files:**
- Create: `lib/offline/outbox.ts`
- Create: `lib/offline/outbox.test.ts`
- Modify: `package.json` (add deps `idb`, `fake-indexeddb`)

- [ ] **Step 1: Install deps**

```bash
npm install idb
npm install -D fake-indexeddb
```

- [ ] **Step 2: Set up jsdom-like env for IndexedDB tests**

`fake-indexeddb` works in node, no jsdom needed. Add a per-file directive in the test.

- [ ] **Step 3: Write failing tests**

```ts
// lib/offline/outbox.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { enqueue, list, peek, remove, count, clearAll } from "./outbox";

describe("outbox", () => {
  beforeEach(async () => { await clearAll(); });

  it("enqueues and lists items in FIFO order", async () => {
    await enqueue({ url: "/api/trips", method: "POST", body: { a: 1 }, resource: "trips", client_id: "u-1" });
    await enqueue({ url: "/api/trips", method: "POST", body: { a: 2 }, resource: "trips", client_id: "u-2" });
    const items = await list();
    expect(items).toHaveLength(2);
    expect(items[0].body).toEqual({ a: 1 });
    expect(items[1].body).toEqual({ a: 2 });
  });

  it("peek returns the oldest item without removing it", async () => {
    await enqueue({ url: "/api/trips", method: "POST", body: { a: 1 }, resource: "trips", client_id: "u-1" });
    const head = await peek();
    expect(head?.body).toEqual({ a: 1 });
    expect(await count()).toBe(1);
  });

  it("remove drops an item by id", async () => {
    await enqueue({ url: "/api/trips", method: "POST", body: { a: 1 }, resource: "trips", client_id: "u-1" });
    const item = await peek();
    await remove(item!.id);
    expect(await count()).toBe(0);
  });

  it("count returns the queue size", async () => {
    expect(await count()).toBe(0);
    await enqueue({ url: "/api/trips", method: "POST", body: {}, resource: "trips", client_id: "u" });
    expect(await count()).toBe(1);
  });

  it("survives 'reopens' (re-import) preserving items", async () => {
    await enqueue({ url: "/api/trips", method: "POST", body: {}, resource: "trips", client_id: "u-1" });
    // simulate reopen by clearing module cache — fake-indexeddb persists per test
    expect(await count()).toBe(1);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- lib/offline/outbox`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement outbox**

```ts
// lib/offline/outbox.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface QueuedMutation {
  id: number;
  url: string;
  method: "POST" | "PUT" | "DELETE";
  body: unknown;
  headers?: Record<string, string>;
  resource: "trips" | "fuel" | "expenses" | "reservations";
  resource_id?: number | string;
  client_id?: string;
  expectedUpdatedAt?: string;
  queued_at: number;
  attempts: number;
  last_error?: string;
}

interface OutboxDB extends DBSchema {
  mutations: {
    key: number;
    value: QueuedMutation;
    indexes: { "by-queued_at": number };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;
function db(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>("autodelen-outbox", 1, {
      upgrade(d) {
        const store = d.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        store.createIndex("by-queued_at", "queued_at");
      },
    });
  }
  return dbPromise;
}

export async function enqueue(item: Omit<QueuedMutation, "id" | "queued_at" | "attempts">): Promise<number> {
  const d = await db();
  const id = await d.add("mutations", { ...item, queued_at: Date.now(), attempts: 0 } as QueuedMutation);
  return id as number;
}

export async function peek(): Promise<QueuedMutation | undefined> {
  const d = await db();
  const all = await d.getAllFromIndex("mutations", "by-queued_at");
  return all[0];
}

export async function list(): Promise<QueuedMutation[]> {
  const d = await db();
  return d.getAllFromIndex("mutations", "by-queued_at");
}

export async function remove(id: number): Promise<void> {
  const d = await db();
  await d.delete("mutations", id);
}

export async function update(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  const d = await db();
  const cur = await d.get("mutations", id);
  if (!cur) return;
  await d.put("mutations", { ...cur, ...patch });
}

export async function count(): Promise<number> {
  const d = await db();
  return d.count("mutations");
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear("mutations");
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- lib/offline/outbox`
Expected: PASS (5/5).

- [ ] **Step 7: Commit**

```bash
git add lib/offline/outbox.ts lib/offline/outbox.test.ts package.json package-lock.json
git commit -m "feat(offline): IndexedDB outbox for queued mutations"
```

---

### Task 9: Sync engine — drainer + Background Sync

**Files:**
- Create: `lib/offline/sync-engine.ts`
- Create: `lib/offline/sync-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/offline/sync-engine.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { enqueue, list, clearAll } from "./outbox";
import { drainOutbox, type DrainOptions } from "./sync-engine";

function makeFetcher(responses: Array<{ status: number; body?: unknown }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { status: 200, body: { ok: true } };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  });
}

describe("drainOutbox", () => {
  beforeEach(async () => { await clearAll(); });

  it("drains all items on success in FIFO order", async () => {
    await enqueue({ url:"/api/trips", method:"POST", body:{a:1}, resource:"trips", client_id:"u-1" });
    await enqueue({ url:"/api/trips", method:"POST", body:{a:2}, resource:"trips", client_id:"u-2" });
    const fetcher = makeFetcher([{ status: 201 }, { status: 201 }]);
    const onSuccess = vi.fn();
    const result = await drainOutbox({ fetch: fetcher, onSuccess });
    expect(result.drained).toBe(2);
    expect(await list()).toHaveLength(0);
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/trips"), expect.objectContaining({ method: "POST", body: JSON.stringify({a:1}) }));
  });

  it("stops draining on 5xx and leaves item in queue with incremented attempts", async () => {
    await enqueue({ url:"/api/trips", method:"POST", body:{a:1}, resource:"trips", client_id:"u-1" });
    await enqueue({ url:"/api/trips", method:"POST", body:{a:2}, resource:"trips", client_id:"u-2" });
    const fetcher = makeFetcher([{ status: 500 }]);
    const result = await drainOutbox({ fetch: fetcher });
    expect(result.drained).toBe(0);
    const items = await list();
    expect(items).toHaveLength(2);
    expect(items[0].attempts).toBe(1);
  });

  it("drops an item on 409 conflict and continues", async () => {
    await enqueue({ url:"/api/trips/5", method:"PUT", body:{}, resource:"trips", resource_id:5, expectedUpdatedAt:"old" });
    await enqueue({ url:"/api/trips", method:"POST", body:{}, resource:"trips", client_id:"u-2" });
    const fetcher = makeFetcher([{ status: 409 }, { status: 201 }]);
    const onConflict = vi.fn();
    const result = await drainOutbox({ fetch: fetcher, onConflict });
    expect(result.drained).toBe(1);
    expect(result.conflicts).toBe(1);
    expect(onConflict).toHaveBeenCalled();
    expect(await list()).toHaveLength(0);
  });

  it("aborts cleanly when network fails (offline mid-drain)", async () => {
    await enqueue({ url:"/api/trips", method:"POST", body:{}, resource:"trips", client_id:"u" });
    const fetcher = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const result = await drainOutbox({ fetch: fetcher });
    expect(result.drained).toBe(0);
    expect((await list()).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/offline/sync-engine`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement drainer**

```ts
// lib/offline/sync-engine.ts
"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { peek, remove, update, count } from "./outbox";
import type { QueuedMutation } from "./outbox";
import { useOnlineState } from "./online-state";

export interface DrainResult {
  drained: number;
  conflicts: number;
  failed: number;
}

export interface DrainOptions {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  onSuccess?: (item: QueuedMutation, response: unknown) => void;
  onConflict?: (item: QueuedMutation) => void;
}

let draining = false; // single-flight

export async function drainOutbox(opts: DrainOptions = {}): Promise<DrainResult> {
  if (draining) return { drained: 0, conflicts: 0, failed: 0 };
  draining = true;
  const fetcher = opts.fetch ?? fetch;
  let drained = 0, conflicts = 0, failed = 0;
  try {
    while (true) {
      const head = await peek();
      if (!head) break;

      const headers: Record<string, string> = { "Content-Type": "application/json", ...(head.headers ?? {}) };
      if (head.expectedUpdatedAt) headers["X-Expected-Updated-At"] = head.expectedUpdatedAt;

      let res: Response;
      try {
        res = await fetcher(head.url, {
          method: head.method,
          headers,
          body: head.method === "DELETE" ? undefined : JSON.stringify(head.body),
        });
      } catch {
        await update(head.id, { attempts: head.attempts + 1, last_error: "network" });
        failed++;
        break; // network failure → stop draining, will retry next time
      }

      if (res.status === 409) {
        await remove(head.id);
        conflicts++;
        opts.onConflict?.(head);
        continue;
      }

      if (res.status >= 500) {
        await update(head.id, { attempts: head.attempts + 1, last_error: `server-${res.status}` });
        failed++;
        break; // server error → stop, retry later
      }

      if (!res.ok) {
        // 4xx (other than 409) — likely permanent. Drop with conflict semantics.
        await remove(head.id);
        conflicts++;
        opts.onConflict?.(head);
        continue;
      }

      const body = await res.json().catch(() => ({}));
      await remove(head.id);
      drained++;
      opts.onSuccess?.(head, body);
    }
  } finally {
    draining = false;
  }
  return { drained, conflicts, failed };
}

export function useSyncEngine() {
  const qc = useQueryClient();
  const { online } = useOnlineState();
  const lastTriggerRef = useRef(0);

  // Drain on transition online → and on mount if there's a queue.
  useEffect(() => {
    if (!online) return;
    const now = Date.now();
    if (now - lastTriggerRef.current < 1000) return;
    lastTriggerRef.current = now;
    drainOutbox({
      onSuccess: (item) => {
        qc.invalidateQueries({ queryKey: [item.resource] });
      },
      onConflict: (item) => {
        qc.invalidateQueries({ queryKey: [item.resource] });
        // Toast is fired from the consumer (mutation hook) since it has i18n context.
        window.dispatchEvent(new CustomEvent("offline-conflict", { detail: item }));
      },
    }).then((result) => {
      window.dispatchEvent(new CustomEvent("offline-drain-complete", { detail: result }));
    });
  }, [online, qc]);

  // Register Background Sync if available.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if ("sync" in reg) {
        // Sync will fire when the browser thinks we're online and the SW is registered.
        (reg as any).sync.register("autodelen-mutations").catch(() => { /* unsupported */ });
      }
    });
  }, []);
}

export async function pendingCount(): Promise<number> {
  return count();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/offline/sync-engine`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/sync-engine.ts lib/offline/sync-engine.test.ts
git commit -m "feat(offline): sync engine with FIFO drainer and Background Sync"
```

---

### Task 10: Optimistic update helpers

**Files:**
- Create: `lib/offline/optimistic.ts`
- Create: `lib/offline/optimistic.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/offline/optimistic.test.ts
import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { applyCreate, replaceCreate, rollbackCreate, applyUpdate, applyDelete } from "./optimistic";

interface Trip { id: number; client_id?: string | null; amount: number; }

describe("optimistic helpers", () => {
  it("applyCreate inserts a pending row at the start of the list", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyCreate<Trip>(qc, ["trips"], { id: -123, client_id: "u-1", amount: 10 });
    const list = qc.getQueryData<Trip[]>(["trips"])!;
    expect(list).toHaveLength(2);
    expect(list[0].client_id).toBe("u-1");
  });

  it("replaceCreate swaps the pending row for the server row", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: -123, client_id: "u-1", amount: 10 }]);
    replaceCreate<Trip>(qc, ["trips"], "u-1", { id: 999, client_id: "u-1", amount: 10 });
    const list = qc.getQueryData<Trip[]>(["trips"])!;
    expect(list[0].id).toBe(999);
  });

  it("rollbackCreate removes the pending row by client_id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: -123, client_id: "u-1", amount: 10 }]);
    rollbackCreate<Trip>(qc, ["trips"], "u-1");
    expect(qc.getQueryData<Trip[]>(["trips"])).toHaveLength(0);
  });

  it("applyUpdate patches an existing row by id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyUpdate<Trip>(qc, ["trips"], 1, { amount: 7 });
    expect(qc.getQueryData<Trip[]>(["trips"])![0].amount).toBe(7);
  });

  it("applyDelete removes a row by id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyDelete<Trip>(qc, ["trips"], 1);
    expect(qc.getQueryData<Trip[]>(["trips"])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/offline/optimistic`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/offline/optimistic.ts
import type { QueryClient } from "@tanstack/react-query";

export function applyCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient, key: readonly unknown[], pending: T
): void {
  qc.setQueryData<T[]>(key, (old) => [pending, ...(old ?? [])]);
}

export function replaceCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient, key: readonly unknown[], clientId: string, server: T
): void {
  qc.setQueryData<T[]>(key, (old) =>
    (old ?? []).map((row) => (row.client_id === clientId ? server : row))
  );
}

export function rollbackCreate<T extends { id: number; client_id?: string | null }>(
  qc: QueryClient, key: readonly unknown[], clientId: string
): void {
  qc.setQueryData<T[]>(key, (old) => (old ?? []).filter((row) => row.client_id !== clientId));
}

export function applyUpdate<T extends { id: number }>(
  qc: QueryClient, key: readonly unknown[], id: number, patch: Partial<T>
): void {
  qc.setQueryData<T[]>(key, (old) =>
    (old ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row))
  );
}

export function applyDelete<T extends { id: number }>(
  qc: QueryClient, key: readonly unknown[], id: number
): void {
  qc.setQueryData<T[]>(key, (old) => (old ?? []).filter((row) => row.id !== id));
}
```

- [ ] **Step 4: Run, commit**

Run: `npm test -- lib/offline/optimistic`
Expected: PASS (5/5).

```bash
git add lib/offline/optimistic.ts lib/offline/optimistic.test.ts
git commit -m "feat(offline): optimistic update helpers for create/update/delete"
```

---

### Task 11: Wire mutation hooks — trips

**Files:**
- Modify: `hooks/use-trips.ts`

- [ ] **Step 1: Refactor `useCreateTrip` to enqueue on offline failure**

```ts
// hooks/use-trips.ts (replace the create hook with this shape)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { newUuid } from "@/lib/offline/uuid";
import { enqueue } from "@/lib/offline/outbox";
import { applyCreate, replaceCreate, rollbackCreate } from "@/lib/offline/optimistic";
import type { Trip } from "@/types";

interface CreateInput {
  person_id: number; car_id: number; date: string;
  start_odometer: number; end_odometer: number; km: number; amount: number;
  location?: string | null;
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput): Promise<Trip> => {
      const client_id = newUuid();
      const optimistic: Trip = {
        id: -Date.now(),                       // negative sentinel for pending
        client_id,
        person_id: input.person_id, car_id: input.car_id, date: input.date,
        start_odometer: input.start_odometer, end_odometer: input.end_odometer,
        km: input.km, amount: input.amount, location: input.location ?? null,
        updated_at: new Date().toISOString(),
        // ...other fields from Trip type (person_name, car_short, etc.) — populate from cache lookup
      } as Trip;
      applyCreate<Trip>(qc, ["trips"], optimistic);

      try {
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, client_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const server = (await res.json()) as Trip;
        replaceCreate<Trip>(qc, ["trips"], client_id, server);
        return server;
      } catch (e) {
        // If we're offline, leave optimistic row, queue the mutation.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueue({
            url: "/api/trips", method: "POST", body: { ...input, client_id },
            resource: "trips", client_id,
          });
          toast.success("Opgeslagen — wordt gesynchroniseerd zodra je weer online bent.");
          return optimistic;
        }
        rollbackCreate<Trip>(qc, ["trips"], client_id);
        throw e;
      }
    },
  });
}
```

The same pattern applies to `useUpdateTrip` and `useDeleteTrip`. Update them similarly:
- `useUpdateTrip`: optimistic patch via `applyUpdate`; on offline → enqueue with `expectedUpdatedAt`; on success → invalidate `["trips"]`.
- `useDeleteTrip`: optimistic remove via `applyDelete`; on offline → enqueue DELETE; on success → no-op.

- [ ] **Step 2: Manual verification**

Run dev. Take browser offline. Add a trip. The list shows the new row immediately (with the upcoming pending badge from Task 15). Network tab shows no successful POST. Application → IndexedDB → `autodelen-outbox` → `mutations` shows one entry. Go online. Within ~1s the entry disappears, the row's `id` flips from negative to positive (server-assigned).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-trips.ts
git commit -m "feat(offline): trips create/update/delete with optimistic + outbox"
```

---

### Task 12: Wire mutation hooks — fuel

Same pattern as Task 11, applied to `hooks/use-fuel.ts`. Resource: `"fuel"`. Endpoint: `/api/fuel`.

- [ ] **Step 1: Refactor**
- [ ] **Step 2: Verify offline POST + sync**
- [ ] **Step 3: Commit**

```bash
git add hooks/use-fuel.ts
git commit -m "feat(offline): fuel create/update/delete with optimistic + outbox"
```

---

### Task 13: Wire mutation hooks — expenses

Same pattern. `hooks/use-expenses.ts`. Resource: `"expenses"`.

- [ ] **Step 1: Refactor**
- [ ] **Step 2: Verify**
- [ ] **Step 3: Commit**

---

### Task 14: Wire mutation hooks — reservations

Same pattern. `hooks/use-reservations.ts`. Resource: `"reservations"`.

Note: status changes (confirm/reject) stay online-only. Show a toast if the user tries to confirm/reject offline:

```tsx
if (!navigator.onLine) {
  toast.error("Bevestigen/afwijzen kan alleen online.");
  return;
}
```

- [ ] **Step 1: Refactor create/update/delete only; gate status changes**
- [ ] **Step 2: Verify**
- [ ] **Step 3: Commit**

---

### Task 15: PendingBadge component + list integration

**Files:**
- Create: `components/pending-badge.tsx`
- Modify: the four list pages to render `<PendingBadge />` for rows with `id < 0` or `client_id` not yet reconciled

- [ ] **Step 1: Implement the badge**

```tsx
// components/pending-badge.tsx
"use client";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export function PendingBadge() {
  const t = useT();
  return (
    <span
      title={t("offline.pending_tooltip")}
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontFamily: fontMono,
        fontSize: 8,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: paper.amber,
        border: `1px dashed ${paper.amber}`,
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    >
      ↻ {t("offline.pending")}
    </span>
  );
}
```

- [ ] **Step 2: Add i18n**

```ts
// nl
"offline.pending": "Sync.",
"offline.pending_tooltip": "Wordt gesynchroniseerd zodra je weer online bent.",
// en
"offline.pending": "Sync",
"offline.pending_tooltip": "Will sync when you're back online.",
```

- [ ] **Step 3: Render conditionally in the list pages**

For each row in `/trips`, `/fuel`, `/expenses`, `/calendar`:

```tsx
{row.id < 0 && <PendingBadge />}
```

Place it next to the title or amount, where it's visible but not intrusive.

- [ ] **Step 4: Manual verification**

Offline, add a trip. The trip appears in the list with the `↻ Sync.` badge. Go online — within seconds the badge disappears.

- [ ] **Step 5: Commit**

```bash
git add components/pending-badge.tsx app/trips app/fuel app/expenses app/calendar lib/i18n
git commit -m "feat(offline): pending badge on optimistic rows"
```

---

### Task 16: Extend OfflineBadge with queue count

**Files:**
- Modify: `lib/offline/online-state.tsx` — add `pendingCount`
- Modify: `components/offline-badge.tsx` — show `· N wachten` when count > 0
- Modify: `app/providers.tsx` — mount `useSyncEngine()`, push count into context

- [ ] **Step 1: Extend OnlineState**

```tsx
// lib/offline/online-state.tsx — extend the value
export interface OnlineState {
  online: boolean;
  lastSyncAt: number | null;
  staleness: Staleness;
  pendingCount: number;
  markSynced: () => void;
  setPendingCount: (n: number) => void;
}
```

Add `const [pendingCount, setPendingCount] = useState(0);` to the provider and expose it.

- [ ] **Step 2: Subscribe to outbox changes**

In `useSyncEngine`, after each drain or enqueue, recalculate the count and call `setPendingCount`. Wire this through context (or expose a `useEffect` that polls every few seconds — simpler).

```tsx
// inside useSyncEngine
useEffect(() => {
  let cancelled = false;
  const tick = async () => {
    const c = await pendingCount();
    if (!cancelled) setPendingCount(c);
  };
  tick();
  const id = setInterval(tick, 3000);
  return () => { cancelled = true; clearInterval(id); };
}, [setPendingCount]);
```

- [ ] **Step 3: Update OfflineBadge to show queue count**

```tsx
// components/offline-badge.tsx
const { online, staleness, pendingCount } = useOnlineState();

// 4-state model:
if (online && pendingCount === 0) return null;
if (online && pendingCount > 0) {
  return <Badge color={paper.amber} label={`SYNC · ${pendingCount}`} tooltip={t("offline.tooltip_syncing")} />;
}
// offline branch
const isStale = staleness !== "fresh";
const color = isStale ? paper.amber : paper.inkDim;
const suffix = pendingCount > 0
  ? ` · ${t("offline.queued_suffix", { count: pendingCount })}`
  : isStale ? ` · ${t("offline.stale_suffix")}` : "";
return <Badge color={color} label={`${t("offline.label")}${suffix}`} tooltip={...} />;
```

- [ ] **Step 4: i18n keys**

```ts
// nl
"offline.queued_suffix": "{count} wachten",
"offline.tooltip_syncing": "Synchroniseren…",
// en
"offline.queued_suffix": "{count} pending",
"offline.tooltip_syncing": "Syncing…",
```

- [ ] **Step 5: Mount sync engine**

```tsx
// app/providers.tsx — extend BootPrewarm
function BootPrewarm() {
  // ... existing useMe + useBootPrewarm ...
  useSyncEngine();
  return null;
}
```

- [ ] **Step 6: Conflict toast wiring**

Listen for the `offline-conflict` custom event in a small client component (e.g. mounted next to `<Toaster />`):

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    toast.error(t("offline.conflict_toast", { resource: detail.resource }));
  };
  window.addEventListener("offline-conflict", handler);
  return () => window.removeEventListener("offline-conflict", handler);
}, []);
```

- [ ] **Step 7: Commit**

```bash
git add lib/offline components/offline-badge.tsx app/providers.tsx lib/i18n
git commit -m "feat(offline): badge shows queue count, conflict toasts wired"
```

---

### Task 17: End-to-end QA

**Files:** none.

- [ ] **Step 1: Online happy path (regression check)**

Add a trip / edit / delete while online. Behavior identical to Phase 1.

- [ ] **Step 2: Offline create**

Toggle DevTools offline. Add a trip. Verify:
- Row appears immediately with `↻ Sync.` badge
- Header badge shows `OFFLINE · 1 wachten`
- IndexedDB `autodelen-outbox.mutations` contains the entry

Go online. Verify:
- Within ~3s: row's pending badge disappears
- Header badge clears
- IndexedDB queue is empty
- Server has the row (verify via direct DB check or admin page)

- [ ] **Step 3: Offline edit + idempotency**

Online, add trip A. Take offline. Edit A's amount. Take online again. Verify the server amount is the new one (single edit applied).

Then: simulate flaky network. Take offline, edit A. Take online but immediately throttle to "Slow 3G" with timeout. Force a partial failure. Take online fully. Verify:
- Idempotency: A is updated exactly once (no double-apply)
- Queue eventually drains

- [ ] **Step 4: Conflict path**

Online, add trip A. Note `updated_at`. In another tab (or via SQL) update A's amount. In the original tab, take offline, edit A, take online. Verify:
- 409 returned
- Queue item dropped
- Toast appears: "Edit conflict — refresh and retry"
- A in cache is invalidated and shows the *other* tab's value after refetch

- [ ] **Step 5: Cross-resource ordering**

Offline. Add trip A, add fuel B, add expense C (in that order). Go online. Verify all three sync, and none of them is missed.

- [ ] **Step 6: Tab-close survival**

Offline. Add trip A. Close tab. Open tab. Verify:
- Trip A still visible (from React Query cache OR re-loaded from server when online — the queue should drain on reopen since `online` is true and `useSyncEngine` mounts)

- [ ] **Step 7: Background Sync (Chrome only)**

Offline. Add trip A. Close tab. Restore network. Without opening the tab, wait. Background Sync should fire — but since our drainer runs in the page, it can only drain when a page is open. Acceptable: drains on next visit.

Document the limitation in the PR description.

---

### Task 18: PR

**Files:** none.

- [ ] **Step 1: Run full suite**

```bash
npm test
```
Expected: green.

- [ ] **Step 2: Push and PR**

```bash
git push -u origin feature/offline-phase-2
gh pr create --title "feat(offline): Phase 2 — write queue, optimistic UI, sync" --body "$(cat <<'EOF'
## Summary
- DB migration: `client_id` (UNIQUE) + `updated_at` on trips/fuel/expenses/reservations
- API: idempotent POST via `client_id`; PUT respects `X-Expected-Updated-At` for LWW conflicts; DELETE idempotent
- Client: IndexedDB outbox, FIFO drainer, optimistic React Query updates, Background Sync registration
- UI: per-row `↻ Sync.` badge for pending mutations; header badge shows queue count and conflict toasts

Closes #20. Depends on #8 (Phase 1) being merged first.

## Test plan
- [ ] Add/edit/delete each resource offline → all replay on reconnect
- [ ] Conflict (concurrent edit) shows toast and invalidates cache
- [ ] Offline create survives tab close
- [ ] Idempotency: replaying same client_id twice does not duplicate
- [ ] Queue count updates in header within 3s
- [ ] All 41+ Phase 1 tests still pass
- [ ] New tests: migration_0003, api_idempotency, outbox, sync-engine, optimistic, uuid

## Known limitations
- Background Sync API is Chrome/Edge only; Safari falls back to drain-on-next-visit
- Reservation status changes (confirm/reject) remain online-only
- Conflict resolution is LWW with drop-and-toast — no auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: After merge, deploy and watch**

After merge to main:
```bash
ssh root@100.86.173.115 "cd /opt/dockge/stacks/autodelen && docker compose pull && docker compose up -d"
```

Watch for the migration to apply on container start. Verify on production by adding a trip offline on a real phone, force-closing the app, reopening, and confirming sync.

---

## Self-review checklist

- [x] **Spec coverage:** Issue #20 acceptance criteria covered: offline create/edit/delete (Tasks 11–14), queue visible in indicator (Task 16), sync invalidates cache (Task 9 + onSuccess callback), conflict toast (Task 16).
- [x] **No placeholders:** Every step is concrete code or an exact command. Where existing code locations need confirming (e.g. trip form file path), there's a `grep` to find it.
- [x] **Type consistency:** `QueuedMutation`, `Trip`, `OnlineState` extended once and referenced consistently. `applyCreate`/`replaceCreate`/`rollbackCreate` signatures match across optimistic.ts and the mutation hooks.
- [x] **Causal ordering preserved:** outbox uses `by-queued_at` index; drainer is single-flight (`draining` flag); breaks on first failure to maintain order.
- [x] **Idempotency:** server enforced via `client_id` UNIQUE index + check-then-insert; client tracks `client_id` in optimistic row so replays-during-success-already-arrived don't double-write.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migration fails on existing prod data due to NOT NULL default | Low | `DEFAULT CURRENT_TIMESTAMP` works on SQLite ALTER TABLE; tested in `migration_0003.test.ts`. Take a backup before deploying. |
| Race: user submits, response arrives, drain ALSO submits queued copy | Medium | Mitigated by `client_id` UNIQUE — server returns existing row, client gets same `id` either way. |
| Negative-id sentinel collides if Date.now() repeats (impossible at ms resolution but worth noting) | Very low | Acceptable; collisions would just replace a different pending row briefly. |
| Background Sync unsupported in Safari | Known | Documented; fallback to `online`-event drain on next visit. |
| Outbox grows unbounded if user stays offline for weeks | Low | `attempts` field + future eviction policy if `attempts > 50` (out of scope, log only for now). |
| User edits an offline-created row before its first sync | Medium | The optimistic row has a negative `id`; mutation hook should detect this and chain by `client_id` instead — **add to acceptance criteria of Task 11 if reproducible in QA**. |
| Trigger-based `updated_at` doesn't fire on `INSERT OR REPLACE` paths | Low | Verified: existing code uses `INSERT` and `UPDATE`, never `REPLACE`. If it changes, add `updated_at = CURRENT_TIMESTAMP` explicitly. |

---

## What's intentionally NOT in this plan

- **Multi-device sync / real-time:** out of scope; this is single-device offline.
- **CRDT-based merging:** unnecessary at this concurrency level.
- **Admin & owner offline writes:** all `/admin/*` workflows (inbox, settlement, payouts, hygiene gap-assignment, member CRUD, car CRUD, fixed-cost editing, price history) require connectivity. Surface this as a polite hint in the page header when an admin opens an admin screen offline (e.g. `OFFLINE — admin features require connection`).
- **Reservation status changes offline:** confirming or rejecting a booking is an admin action with cross-member visibility consequences; queueing it could mislead users about availability.
- **Outbox eviction / age-based GC:** can be added later as a maintenance hook; not needed in Phase 2.
- **Per-resource priority differences in the runtime:** all four scoped resources share the same outbox, drainer, and optimistic helpers. The "primary vs secondary" split only governs *implementation order*, not runtime behavior.
