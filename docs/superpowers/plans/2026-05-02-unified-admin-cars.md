# Unified Admin Cars — Owner Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the `/owner` dashboard into `/admin/cars`, giving owners CRUD access to their own cars alongside the existing admin view, and deprecate the `/owner` URL.

**Architecture:** The page uses `me.isAdmin` to select between two views: admins see the existing accordion list; owners see fleet tiles for their own cars only, with inline edit/create/delete. API routes are relaxed from `requireAdmin` to allow car owners to mutate their own cars (ownership verified server-side). `/owner` becomes a server-side redirect to `/admin/cars`.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, TanStack Query v5, Zod, iron-session

---

## File map

| File | Change |
|------|--------|
| `lib/queries/cars.ts` | Add `carHasHistory`, `deleteCar` |
| `lib/api.ts` | Add `conflict()` helper |
| `lib/schemas/car.ts` | Add `ownerCarPatchSchema` |
| `app/api/cars/route.ts` | POST: `requireAdmin` → `requireAdminOrOwner`, force `owner_name` |
| `app/api/cars/[id]/route.ts` | PUT: relax to owner, add DELETE handler |
| `hooks/use-cars.ts` | Export `useDeleteCar`, `useCreateCar` |
| `lib/i18n/messages/nl.ts` | Add owner car management keys |
| `lib/i18n/messages/en.ts` | Same keys in English |
| `app/admin/cars/page.tsx` | Add `OwnerScreen` type, `OwnerCarTile`, `OwnerCreateForm`, `OwnerFleet`; update access guard |
| `app/admin/layout.tsx` | Remove `/owner` nav entry |
| `app/owner/page.tsx` | Server-side redirect to `/admin/cars` |
| `app/owner/layout.tsx` | Simplify to pass-through |

---

### Task 1: Data layer — `carHasHistory` + `deleteCar`

**Files:**
- Modify: `lib/queries/cars.ts`
- Modify: `lib/__tests__/queries_cars.test.ts`

- [ ] **Step 1: Add failing tests for `carHasHistory` and `deleteCar`**

Add these two `describe` blocks at the bottom of `lib/__tests__/queries_cars.test.ts` (the file already imports `makeDb`, `baseCar`, `insertCar`, `getCarById`):

```typescript
describe("carHasHistory", () => {
  it("returns false for a fresh car with no trips, fuel, expenses, or reservations", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    expect(carHasHistory(db, id)).toBe(false);
  });

  it("returns true when the car has at least one trip", () => {
    const db = makeDb();
    db.exec(`INSERT INTO people (id, name, active) VALUES (1, 'Alice', 1)`);
    const id = insertCar(db, { ...baseCar, owner_name: "Alice" });
    db.exec(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount)
       VALUES (1, ${id}, '2025-01-01', 0, 10, 10, 2.0)`
    );
    expect(carHasHistory(db, id)).toBe(true);
  });
});

describe("deleteCar", () => {
  it("removes the car from the database", () => {
    const db = makeDb();
    const id = insertCar(db, baseCar);
    expect(getCarById(db, id)).not.toBeNull();
    deleteCar(db, id);
    expect(getCarById(db, id)).toBeNull();
  });

  it("does not throw for a non-existent id", () => {
    const db = makeDb();
    expect(() => deleteCar(db, 9999)).not.toThrow();
  });
});
```

Update the import line at the top of that test file to include `carHasHistory` and `deleteCar`:

```typescript
import { getCars, getCarById, insertCar, updateCar, carHasHistory, deleteCar } from "../queries/cars";
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd .worktrees/feature/issue-88
npx vitest run lib/__tests__/queries_cars.test.ts
```

Expected: failures referencing `carHasHistory is not a function` and `deleteCar is not a function`.

- [ ] **Step 3: Implement `carHasHistory` and `deleteCar` in `lib/queries/cars.ts`**

Append to the end of `lib/queries/cars.ts`:

```typescript
export function carHasHistory(db: Database.Database, id: number): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM trips      WHERE car_id = ? LIMIT 1
       UNION ALL
       SELECT 1 FROM fuel_fillups WHERE car_id = ? LIMIT 1
       UNION ALL
       SELECT 1 FROM expenses   WHERE car_id = ? LIMIT 1
       UNION ALL
       SELECT 1 FROM reservations WHERE car_id = ? LIMIT 1`
    )
    .get(id, id, id, id);
  return row !== undefined;
}

export function deleteCar(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM cars WHERE id = ?").run(id);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/__tests__/queries_cars.test.ts
```

Expected: all tests PASS, including the new ones.

- [ ] **Step 5: Commit**

```bash
git -C .worktrees/feature/issue-88 add lib/queries/cars.ts lib/__tests__/queries_cars.test.ts
git -C .worktrees/feature/issue-88 commit -m "feat(cars): add carHasHistory and deleteCar query functions"
```

---

### Task 2: Add `conflict()` helper + `ownerCarPatchSchema`

**Files:**
- Modify: `lib/api.ts`
- Modify: `lib/schemas/car.ts`

- [ ] **Step 1: Add `conflict()` to `lib/api.ts`**

After the `forbidden()` function (around line 30), add:

```typescript
/** Throws an HttpError with status 409. */
export function conflict(msg = "Conflict"): never {
  throw new HttpError(409, msg);
}
```

- [ ] **Step 2: Add `ownerCarPatchSchema` to `lib/schemas/car.ts`**

Append to the end of `lib/schemas/car.ts`:

```typescript
export const ownerCarPatchSchema = z.object({
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  active: z.number().int().min(0).max(1).optional(),
});
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git -C .worktrees/feature/issue-88 add lib/api.ts lib/schemas/car.ts
git -C .worktrees/feature/issue-88 commit -m "feat(api): add conflict() helper and ownerCarPatchSchema"
```

---

### Task 3: API routes — relax auth, add DELETE

**Files:**
- Modify: `app/api/cars/route.ts`
- Modify: `app/api/cars/[id]/route.ts`

- [ ] **Step 1: Update `app/api/cars/route.ts`**

Replace the full file content:

```typescript
import { NextResponse } from "next/server";
import { getCars, insertCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import { json, readBody, requireAdminOrOwner } from "@/lib/api";

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  const session = await requireAdminOrOwner(req);
  const data = await readBody(req, carSchema);
  if (!session.isAdmin) {
    data.owner_name = session.personName!;
  }
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
```

- [ ] **Step 2: Update `app/api/cars/[id]/route.ts`**

Replace the full file content:

```typescript
import { getCarById, updateCar, deleteCar, carHasHistory } from "@/lib/queries/cars";
import { carSchema, ownerCarPatchSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import { json, readBody, readId, notFound, forbidden, conflict, requireAdmin, requireAdminOrOwner } from "@/lib/api";

export const GET = json(async (_req, ctx) => {
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx) => {
  const session = await requireAdminOrOwner(req);
  const id = await readId(ctx);
  const db = getDb();

  if (!session.isAdmin) {
    const current = getCarById(db, id);
    if (!current || current.owner_name !== session.personName) forbidden();
    const patch = await readBody(req, ownerCarPatchSchema);
    updateCar(db, id, {
      short: current.short,
      name: patch.name,
      price_per_km: patch.price_per_km,
      brand: current.brand,
      color: current.color,
      owner_name: current.owner_name,
      long_threshold: current.long_threshold,
      fixed_costs_json: current.fixed_costs_json,
      active: patch.active ?? current.active,
      expected_km: current.expected_km,
    });
    return { ok: true };
  }

  const data = await readBody(req, carSchema);
  updateCar(db, id, data);
  return { ok: true };
});

export const DELETE = json(async (req, ctx) => {
  const session = await requireAdminOrOwner(req);
  const id = await readId(ctx);
  const db = getDb();
  const car = getCarById(db, id);
  if (!car) notFound();
  if (!session.isAdmin && car.owner_name !== session.personName) forbidden();
  if (carHasHistory(db, id)) conflict("Car has reservations or trips — deactivate instead");
  deleteCar(db, id);
  return { ok: true };
});
```

Note: `requireAdmin` is kept in the import list in case it's used elsewhere; the linter will flag it if unused — remove it then.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass. Check `lib/__tests__/api.test.ts` specifically for any car-related tests that may need updating.

- [ ] **Step 4: Commit**

```bash
git -C .worktrees/feature/issue-88 add app/api/cars/route.ts "app/api/cars/[id]/route.ts"
git -C .worktrees/feature/issue-88 commit -m "feat(api): allow car owners to create/update/delete their own cars"
```

---

### Task 4: Export `useDeleteCar` and `useCreateCar` from `hooks/use-cars.ts`

**Files:**
- Modify: `hooks/use-cars.ts`

- [ ] **Step 1: Update `hooks/use-cars.ts`**

Replace the full file content:

```typescript
import { createResourceHooks } from "./use-resource";
import type { Car } from "@/types";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/cars", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
export const useDeleteCar = hooks.useDelete;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd .worktrees/feature/issue-88 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `use-cars.ts`.

- [ ] **Step 3: Commit**

```bash
git -C .worktrees/feature/issue-88 add hooks/use-cars.ts
git -C .worktrees/feature/issue-88 commit -m "feat(hooks): export useDeleteCar and useCreateCar"
```

---

### Task 5: i18n — owner car management keys

**Files:**
- Modify: `lib/i18n/messages/nl.ts`
- Modify: `lib/i18n/messages/en.ts`

- [ ] **Step 1: Add keys to `lib/i18n/messages/nl.ts`**

Find the block that starts with `"owner.title"` (around line 478) and extend it:

```typescript
  "owner.title": "Mijn wagens",
  "owner.subtitle": "Economische gezondheid · {year}",
  "owner.no_cars": "Je hebt geen wagens in de co-op.",
  "owner.back_fleet": "← Vloot",
  "owner.add_car": "Nieuwe wagen",
  "owner.edit_car": "Bewerken",
  "owner.delete_confirm": "Zeker verwijderen?",
  "owner.car_has_history": "Kan niet verwijderen: wagen heeft al ritten of reservaties. Deactiveer de wagen.",
```

Also add `"form.short"` near the other `form.*` keys (around line 76):

```typescript
  "form.short": "Afkorting (bijv. ETH)",
```

- [ ] **Step 2: Add the same keys to `lib/i18n/messages/en.ts`**

Find the `owner.*` block and extend it:

```typescript
  "owner.title": "My cars",
  "owner.subtitle": "Economic health · {year}",
  "owner.no_cars": "You have no cars in the co-op.",
  "owner.back_fleet": "← Fleet",
  "owner.add_car": "New car",
  "owner.edit_car": "Edit",
  "owner.delete_confirm": "Sure? Tap again to delete.",
  "owner.car_has_history": "Cannot delete: car has trips or reservations. Deactivate instead.",
```

And `"form.short"` near the other `form.*` keys:

```typescript
  "form.short": "Short code (e.g. ETH)",
```

- [ ] **Step 3: Run i18n tests**

```bash
npx vitest run lib/__tests__/i18n.test.ts
```

Expected: PASS (the i18n test checks that nl and en have the same keys).

- [ ] **Step 4: Commit**

```bash
git -C .worktrees/feature/issue-88 add lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git -C .worktrees/feature/issue-88 commit -m "feat(i18n): add owner car management keys"
```

---

### Task 6: Owner view in `/admin/cars`

**Files:**
- Modify: `app/admin/cars/page.tsx`

This is the largest task. The current file (423 lines) gains `OwnerCarTile`, `OwnerCreateForm`, `OwnerFleet`, and an updated `AdminWagensPage`. The existing `CarRow` and `FleetTiles` components are untouched.

- [ ] **Step 1: Update the import block at the top of `app/admin/cars/page.tsx`**

Replace the existing import block (lines 1–14) with:

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { Car } from "@/types";
import { useCars, useCreateCar, useUpdateCar, useDeleteCar } from "@/hooks/use-cars";
import { usePeople } from "@/hooks/use-people";
import { useAdminSummary, beMetrics, Card, Perf } from "../_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { toast } from "sonner";
import { CarBadge } from "@/components/car-badge";
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";
```

- [ ] **Step 2: Add the `OwnerScreen` type after the imports (before `CarRow`)**

```typescript
// ── Owner screen state ────────────────────────────────────────
type OwnerScreen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number }
  | { view: "create" };
```

- [ ] **Step 3: Add `OwnerCarTile` component after `FleetTiles` (before the page export)**

```typescript
// ── Owner car tile (fleet list item with inline edit) ─────────
function OwnerCarTile({
  car,
  pnlData,
  onDetail,
  onRate,
}: {
  car: Car;
  pnlData: ReturnType<typeof beMetrics> | null;
  onDetail: () => void;
  onRate: () => void;
}) {
  const t = useT();
  const updateCar = useUpdateCar();
  const deleteCar = useDeleteCar();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(car.name);
  const [price, setPrice] = useState(car.price_per_km);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [prevId, setPrevId] = useState(car.id);
  if (car.id !== prevId) {
    setPrevId(car.id);
    setName(car.name);
    setPrice(car.price_per_km);
    setEditOpen(false);
    setDeleteConfirm(false);
  }

  const dirty = name !== car.name || price !== car.price_per_km;
  const isActive = car.active !== 0;
  const statusColor = pnlData
    ? pnlData.status === "ahead" ? paper.green : pnlData.status === "on_pace" ? paper.amber : paper.accent
    : paper.inkMute;
  const statusLabel = pnlData
    ? pnlData.status === "ahead" ? t("fleet.stamp_ahead") : pnlData.status === "on_pace" ? t("fleet.stamp_on_pace") : t("fleet.stamp_behind")
    : null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontFamily: fontMono,
    fontSize: 11,
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    color: paper.ink,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 9,
    color: paper.inkDim,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 3,
  };

  function handleSave() {
    updateCar.mutate(
      { id: car.id, name, price_per_km: price, active: car.active } as Car & { id: number },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  function handleToggleActive() {
    updateCar.mutate(
      { id: car.id, name: car.name, price_per_km: car.price_per_km, active: isActive ? 0 : 1 } as Car & { id: number },
      { onSuccess: () => toast.success(t("toast.saved")) }
    );
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    deleteCar.mutate(car.id, {
      onError: () => {
        toast.error(t("owner.car_has_history"));
        setDeleteConfirm(false);
      },
    });
  }

  return (
    <Card style={{ marginBottom: 10, borderLeft: `3px solid ${isActive ? statusColor : paper.inkMute}`, opacity: isActive ? 1 : 0.6 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CarBadge short={car.short} active={isActive} />
          <div>
            <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink }}>{car.name}</div>
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1 }}>€{car.price_per_km.toFixed(2)}/km</div>
          </div>
        </div>
        {statusLabel && (
          <div style={{ padding: "3px 8px", border: `1.5px solid ${statusColor}`, color: statusColor, fontFamily: fontMono, fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", transform: "rotate(-3deg)", flexShrink: 0 }}>
            {statusLabel}
          </div>
        )}
      </div>

      {/* Burden summary */}
      {pnlData && pnlData.fixedCovered < pnlData.remainingBurden + pnlData.fixedCovered && (
        <>
          <div style={{ fontFamily: fontSerif, fontSize: 24, fontWeight: 700, color: statusColor, lineHeight: 1, margin: "4px 0 2px" }}>
            {fmtMoney(pnlData.remainingBurden)}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 6 }}>
            {t("fleet.remaining_burden")} · {t("fleet.pct_covered", { pct: Math.round(pnlData.pctCovered * 100) })}
          </div>
          <div style={{ height: 3, background: paper.paperDeep, position: "relative", marginBottom: 8 }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${Math.min(1, pnlData.pctCovered) * 100}%`, background: statusColor }} />
          </div>
        </>
      )}

      <Perf margin="8px 0" />

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onDetail} style={{ flex: 1, padding: "8px", background: paper.ink, color: paper.paper, border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("fleet.see_breakeven")}
        </button>
        <button onClick={onRate} style={{ flex: 1, padding: "8px", background: "transparent", color: paper.ink, border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("rate.open")}
        </button>
        <button onClick={() => { setEditOpen((o) => !o); setDeleteConfirm(false); }} style={{ padding: "8px 10px", background: editOpen ? paper.paperDark : "transparent", color: paper.ink, border: `1.5px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {t("owner.edit_car")}
        </button>
      </div>

      {/* Inline edit */}
      {editOpen && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, marginTop: 12, paddingTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("form.price_per_km")}</label>
            <input type="number" step="0.005" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => { setName(car.name); setPrice(car.price_per_km); setEditOpen(false); setDeleteConfirm(false); }} style={{ flex: 1, padding: "8px", background: "transparent", color: paper.inkDim, border: `1px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
              {t("action.cancel")}
            </button>
            <button disabled={!dirty || updateCar.isPending} onClick={handleSave} style={{ flex: 2, padding: "8px", background: dirty && !updateCar.isPending ? paper.ink : paper.paperDark, color: dirty && !updateCar.isPending ? paper.paper : paper.inkMute, border: "none", cursor: dirty && !updateCar.isPending ? "pointer" : "default", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
              {updateCar.isPending ? "…" : t("action.save")}
            </button>
          </div>
          <button onClick={handleToggleActive} disabled={updateCar.isPending} style={{ width: "100%", marginBottom: 6, padding: "8px", background: isActive ? paper.accent : paper.green, color: paper.paper, border: "none", cursor: updateCar.isPending ? "default" : "pointer", opacity: updateCar.isPending ? 0.6 : 1, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {isActive ? t("admin.deactivate") : t("admin.activate")}
          </button>
          <button onClick={handleDelete} disabled={deleteCar.isPending} style={{ width: "100%", padding: "8px", background: deleteConfirm ? paper.accent : "transparent", color: deleteConfirm ? paper.paper : paper.accent, border: `1px solid ${paper.accent}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {deleteCar.isPending ? "…" : deleteConfirm ? t("owner.delete_confirm") : t("action.delete")}
          </button>
          {deleteConfirm && (
            <button onClick={() => setDeleteConfirm(false)} style={{ width: "100%", marginTop: 4, padding: "6px", background: "transparent", color: paper.inkDim, border: `1px solid ${paper.paperDark}`, cursor: "pointer", fontFamily: fontMono, fontSize: 8, letterSpacing: 1 }}>
              {t("action.cancel")}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Add `OwnerCreateForm` component after `OwnerCarTile`**

```typescript
// ── Owner create form ─────────────────────────────────────────
function OwnerCreateForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const createCar = useCreateCar();
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [price, setPrice] = useState(0.2);

  const valid = name.trim().length > 0 && short.trim().length > 0 && short.length <= 10 && price > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontFamily: fontMono,
    fontSize: 11,
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    color: paper.ink,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 9,
    color: paper.inkDim,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 3,
  };

  function handleSubmit() {
    if (!valid || createCar.isPending) return;
    createCar.mutate(
      { short: short.toUpperCase(), name, price_per_km: price } as Omit<Car, "id">,
      { onSuccess: onBack }
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <button onClick={onBack} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
        ← {t("owner.back_fleet")}
      </button>
      <Card>
        <div style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700, color: paper.ink, marginBottom: 12 }}>
          {t("owner.add_car")}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{t("form.short")}</label>
          <input value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} maxLength={10} placeholder="ETH" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t("form.price_per_km")}</label>
          <input type="number" step="0.005" min="0.01" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} />
        </div>
        <button disabled={!valid || createCar.isPending} onClick={handleSubmit} style={{ width: "100%", padding: "10px", background: valid && !createCar.isPending ? paper.ink : paper.paperDark, color: valid && !createCar.isPending ? paper.paper : paper.inkMute, border: "none", cursor: valid && !createCar.isPending ? "pointer" : "default", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {createCar.isPending ? "…" : t("owner.add_car")}
        </button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Add `OwnerFleet` component after `OwnerCreateForm`**

```typescript
// ── Owner fleet view ──────────────────────────────────────────
function OwnerFleet({ myName }: { myName: string }) {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [screen, setScreen] = useState<OwnerScreen>({ view: "fleet" });

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data: cars = [] } = useCars();
  const { data: summary } = useAdminSummary(year);

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const myCars = cars.filter((c) => c.owner_name === myName);
  const allPnL = summary?.carPnL ?? [];
  const monthlyKm = summary?.monthlyCarKm ?? [];
  const contributions = summary?.personContributions ?? [];
  const historicalKm = summary?.historicalCarKm ?? [];
  const priceHistory = summary?.priceHistory ?? [];

  if (screen.view === "detail") {
    const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
    if (!pnlCar) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setScreen({ view: "fleet" })} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
          ← {t("owner.back_fleet")}
        </button>
        <BreakEvenCard
          car={pnlCar}
          fullCar={carMap.get(screen.carId)}
          monthlyKm={monthlyKm.filter((m) => m.car_id === screen.carId)}
          contributions={contributions.filter((c) => c.car_id === screen.carId)}
          historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
          priceHistory={priceHistory.filter((h) => h.car_id === screen.carId)}
          year={year}
          onRateOpen={() => setScreen({ view: "rate", carId: screen.carId })}
        />
      </div>
    );
  }

  if (screen.view === "rate") {
    const pnlCar = allPnL.find((c) => c.car_id === screen.carId);
    if (!pnlCar) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button onClick={() => setScreen({ view: "detail", carId: screen.carId })} style={{ marginBottom: 12, padding: "7px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
          ← {t("fleet.see_breakeven")}
        </button>
        <RateAssistant
          car={pnlCar}
          fullCar={carMap.get(screen.carId)}
          historicalKm={historicalKm.filter((h) => h.car_id === screen.carId)}
          year={year}
          onCommit={() => setScreen({ view: "fleet" })}
        />
      </div>
    );
  }

  if (screen.view === "create") {
    return <OwnerCreateForm onBack={() => setScreen({ view: "fleet" })} />;
  }

  // Fleet list
  return (
    <div style={{ padding: "16px" }}>
      {/* Year selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <button onClick={() => setYear((y) => y - 1)} disabled={year <= earliestYear} style={{ padding: "6px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, borderRight: "none", fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: year <= earliestYear ? paper.inkMute : paper.ink, cursor: year <= earliestYear ? "default" : "pointer", letterSpacing: 1 }}>
          ← {year - 1}
        </button>
        <div style={{ padding: "6px 18px", background: paper.ink, color: paper.paper, fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, border: `1.5px solid ${paper.ink}` }}>
          {year}
        </div>
        <button onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear} style={{ padding: "6px 14px", background: "transparent", border: `1.5px solid ${paper.ink}`, borderLeft: "none", fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: year >= currentYear ? paper.inkMute : paper.ink, cursor: year >= currentYear ? "default" : "pointer", letterSpacing: 1 }}>
          {year + 1} →
        </button>
      </div>

      {/* Add car */}
      <button onClick={() => setScreen({ view: "create" })} style={{ display: "block", width: "100%", marginBottom: 12, padding: "10px 14px", background: "transparent", border: `1.5px dashed ${paper.ink}`, color: paper.ink, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", textAlign: "center" }}>
        + {t("owner.add_car")}
      </button>

      {myCars.length === 0 ? (
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, textAlign: "center", padding: "32px 0" }}>
          {t("owner.no_cars")}
        </div>
      ) : (
        myCars.map((car) => {
          const pnlCar = allPnL.find((c) => c.car_id === car.id);
          const m = pnlCar ? beMetrics(pnlCar) : null;
          return (
            <OwnerCarTile
              key={car.id}
              car={car}
              pnlData={m}
              onDetail={() => setScreen({ view: "detail", carId: car.id })}
              onRate={() => setScreen({ view: "rate", carId: car.id })}
            />
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace the `AdminWagensPage` export (last function in the file)**

Find and replace the existing `AdminWagensPage` (currently lines 415–423):

```typescript
// ── Page ──────────────────────────────────────────────────────
export default function AdminWagensPage() {
  const { data: me, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && me && !me.isAdmin && !me.isOwner) {
      router.replace("/");
    }
  }, [me, isLoading, router]);

  if (isLoading || !me) return null;
  if (!me.isAdmin && !me.isOwner) return null;

  if (me.isAdmin) return <FleetTiles />;
  return <OwnerFleet myName={me.personName!} />;
}
```

- [ ] **Step 7: Run TypeScript check**

```bash
cd .worktrees/feature/issue-88 && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Fix any type errors before proceeding.

- [ ] **Step 8: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git -C .worktrees/feature/issue-88 add app/admin/cars/page.tsx
git -C .worktrees/feature/issue-88 commit -m "feat(cars): add owner fleet view with create/edit/delete to /admin/cars"
```

---

### Task 7: Nav + routing cleanup

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `app/owner/page.tsx`
- Modify: `app/owner/layout.tsx`

- [ ] **Step 1: Remove `/owner` from the admin nav in `app/admin/layout.tsx`**

Find the `OWNER_PAGES` constant and `ALL_PAGES` array. Make these two changes:

```typescript
// Before:
const OWNER_PAGES = ["/admin", "/admin/hygiene", "/admin/settlement", "/owner"];

// After:
const OWNER_PAGES = ["/admin", "/admin/hygiene", "/admin/settlement", "/admin/cars"];
```

```typescript
// Before (inside ALL_PAGES):
{ href: "/admin/cars", label: t("admin.sub_cars") },
// ...
{ href: "/owner", label: t("owner.title") },

// After — remove the /owner entry entirely; /admin/cars remains:
{ href: "/admin/cars", label: t("admin.sub_cars") },
// (no /owner entry)
```

- [ ] **Step 2: Replace `app/owner/page.tsx` with a server-side redirect**

Replace the entire file content with:

```typescript
import { redirect } from "next/navigation";

export default function OwnerPage() {
  redirect("/admin/cars");
}
```

This is now a Server Component (no `"use client"`) so the redirect happens before any client code runs.

- [ ] **Step 3: Simplify `app/owner/layout.tsx` to a pass-through**

Replace the entire file content with:

```typescript
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git -C .worktrees/feature/issue-88 add app/admin/layout.tsx app/owner/page.tsx app/owner/layout.tsx
git -C .worktrees/feature/issue-88 commit -m "feat(nav): merge /owner into /admin/cars, remove MIJN WAGENS tab"
```

---

## Self-review

**Spec coverage:**
- ✅ Owner can create cars (Task 3 POST + Task 6 OwnerCreateForm)
- ✅ Owner can update name + price/km (Task 3 PUT + Task 6 OwnerCarTile edit)
- ✅ Owner can toggle activate/deactivate (Task 3 PUT active field + Task 6 toggle button)
- ✅ Owner can delete cars with guard (Task 3 DELETE + Task 1 carHasHistory)
- ✅ Admin sees all cars unchanged (FleetTiles untouched)
- ✅ Break-even and rate assistant accessible from owner view (Task 6 OwnerFleet detail/rate screens)
- ✅ `/owner` URL deprecated with server redirect (Task 7)
- ✅ Top menu stays visible — admin layout wraps `/admin/cars` unchanged (Task 7)
- ✅ "MIJN WAGENS" tab removed from nav (Task 7)

**Placeholder scan:** None found.

**Type consistency:** `OwnerScreen` defined in Task 6 step 2, used in `OwnerFleet` step 5. `beMetrics` return type used in `OwnerCarTile` prop matches what `beMetrics()` actually returns (`ReturnType<typeof beMetrics>`).
