# Owner Dashboard (/owner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `/admin/payout` to a new `/owner` route accessible to any car owner (not admin-only), and redesign it as a break-even / cost-recovery economics dashboard replacing the old settlement-amount framing.

**Architecture:** The new `/owner` page lives outside `/admin`, is guarded by `requireAdminOrOwner` (already in `lib/api.ts`), and is surfaced in the admin tab nav for any user where `me.isAdmin || me.isOwner`. All break-even math already lives in `beMetrics()` in `app/admin/_shared.tsx` and is reused verbatim. The page fetches the existing `/api/admin/summary` endpoint (which is already gated by `requireAdminOrOwner`) and filters results to the logged-in owner's cars. Three sub-views are rendered as in-page state transitions (no new routes): fleet overview → break-even detail → rate assistant.

**Tech Stack:** Next.js 16 App Router, React (client components), TanStack Query, better-sqlite3, iron-session, Zod, pure CSS-in-JS inline styles (paper-theme), Vitest for unit tests, Playwright for E2E.

---

## Context: what already exists

Before touching anything, understand what is already in place:

- `lib/queries/admin.ts` — `getCarPnL()` computes `fixed_total`, `variable_total`, `trip_km`, `trip_revenue`, `owner_trip_amount`, `prev_year_trip_km`. `CarPnL` type has everything needed.
- `app/admin/_shared.tsx` — `beMetrics(car: CarPnL)` computes `variablePerKm`, `contribPerKm`, `fixedCovered`, `remainingBurden`, `pctCovered`, `projectedBurden`, `breakEvenKm`, `kmGap`, `status`. Also exports `BurdenMeter`, `Card`, `Row`, `Perf`, `useAdminSummary`, `useOwnerCarShorts`, `beMetrics`, `FixedCostEditor`.
- `app/admin/cars/page.tsx` — fully-built `BreakEvenCard` component with burden curve SVG, contribution ledger, rate assistant, and price history. This logic must be **reused, not duplicated**.
- `app/api/admin/summary/route.ts` — already gated with `requireAdminOrOwner` (via the settlement query which uses the same guard). Actually: this route currently has **no auth guard**. See Task 1.
- `hooks/use-me.ts` — `Me` interface has `isOwner: boolean`.
- `components/bottom-tab-bar.tsx` — already shows admin tab when `me.isAdmin || me.isOwner`.
- `app/admin/layout.tsx` — `SubNav` filters pages for non-admins using `OWNER_PAGES`.
- `lib/i18n/messages/nl.ts` + `en.ts` — already has `fleet.*`, `breakeven.*`, `rate.*`, `payout.*` keys.

---

## Task 1 — Guard `/api/admin/summary` with `requireAdminOrOwner`

The admin summary endpoint is currently **unprotected**. Before exposing a `/owner` page that uses it, lock it down.

**File:** `app/api/admin/summary/route.ts`

- [ ] Read the current file (it has no auth guard).
- [ ] Add `requireAdminOrOwner` call at the top of the `GET` handler.

**Implementation:**

```typescript
// app/api/admin/summary/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getCarPnL,
  getKmGaps,
  getZeroKmTrips,
  getMonthlyCarKm,
  getPersonContributions,
  getHistoricalCarKm,
  getPriceHistory,
} from "@/lib/queries/admin";
import { getDashboard } from "@/lib/queries/dashboard";
import { json, requireAdminOrOwner } from "@/lib/api";

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const db = getDb();

  return {
    carPnL: getCarPnL(db, year),
    settlement: getDashboard(db, year),
    kmGaps: getKmGaps(db),
    zeroKmTrips: getZeroKmTrips(db),
    monthlyCarKm: getMonthlyCarKm(db, year),
    personContributions: getPersonContributions(db, year),
    historicalCarKm: getHistoricalCarKm(db, year),
    priceHistory: getPriceHistory(db),
  };
});
```

**Test:** Existing `lib/__tests__/queries_admin.test.ts` covers the query layer. Add an integration note: the auth guard is tested via the `requireAdminOrOwner` unit tests in `lib/__tests__/api_helpers.test.ts`.

**Verify:**
```bash
npx vitest run lib/__tests__/api_helpers.test.ts
# Expected: all existing tests pass (no regressions)
```

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add app/api/admin/summary/route.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "fix(api): require auth on /api/admin/summary"
```

---

## Task 2 — Add `/owner` page scaffold with access control

Create the new page at `app/owner/page.tsx` and its layout at `app/owner/layout.tsx`. The page is accessible to any member where `me.isOwner || me.isAdmin`. Non-owners are redirected to `/`.

**Files to create:**
- `app/owner/layout.tsx`
- `app/owner/page.tsx`

**`app/owner/layout.tsx`:**

```typescript
"use client";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { paper } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <Suspense>
        <PageHeader title={t("owner.title")} subtitle={t("owner.subtitle", { year })} />
      </Suspense>
      {children}
    </div>
  );
}
```

**`app/owner/page.tsx` (scaffold):**

```typescript
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono } from "@/lib/paper-theme";

// Screens are rendered via in-page state (no sub-routes needed)
type Screen = "fleet" | { type: "detail"; carId: number } | { type: "rate"; carId: number };

export default function OwnerPage() {
  const { data: me, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && me && !me.isOwner && !me.isAdmin) {
      router.replace("/");
    }
  }, [me, isLoading, router]);

  if (isLoading || !me) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>
          …
        </div>
      </div>
    );
  }

  if (!me.isOwner && !me.isAdmin) return null;

  return <OwnerDashboard />;
}

function OwnerDashboard() {
  // Implemented in Task 3
  return null;
}
```

**Add i18n keys** to `lib/i18n/messages/nl.ts` and `lib/i18n/messages/en.ts`:

```typescript
// nl.ts additions
"owner.title": "Mijn wagens",
"owner.subtitle": "Economische gezondheid · {year}",
"owner.no_cars": "Je hebt geen wagens in de co-op.",
"owner.back_fleet": "← Vloot",
```

```typescript
// en.ts additions
"owner.title": "My cars",
"owner.subtitle": "Fleet economics · {year}",
"owner.no_cars": "You have no cars in the co-op.",
"owner.back_fleet": "← Fleet",
```

**Verify:**
```bash
npx vitest run lib/__tests__/i18n.test.ts
# Expected: no missing key errors; all tests pass
```

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add app/owner/layout.tsx app/owner/page.tsx lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "feat(owner): scaffold /owner page with access control"
```

---

## Task 3 — Add `/owner` to the admin tab nav

Non-admin owners see a reduced nav. Currently `OWNER_PAGES` in `app/admin/layout.tsx` controls which admin sub-pages owners can access. The new `/owner` page is **not** under `/admin`, so no change is needed there. But we need to wire `/owner` into the bottom tab bar and optionally add a redirect from `/admin/payout`.

**Step 3a — Keep admin tab pointing to `/admin`** (existing behaviour) — no change needed.

**Step 3b — Add redirect from `/admin/payout` to `/owner`**

Owners who bookmark `/admin/payout` should land on the new page. Non-admins are already filtered in the admin nav, but to be safe add a redirect:

**File:** `app/admin/payout/page.tsx` — replace the current content with a redirect:

```typescript
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPayoutRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/owner");
  }, [router]);
  return null;
}
```

**Step 3c — Add `/owner` to the admin sub-nav for owners**

Edit `app/admin/layout.tsx`. Add `/owner` to `OWNER_PAGES` and to `ALL_PAGES` so owners see it in the tab strip when browsing `/admin`:

```typescript
// app/admin/layout.tsx — updated constants (show relevant changes only)
const OWNER_PAGES = ["/admin", "/admin/hygiene", "/admin/settlement", "/owner"];

// In ALL_PAGES array, replace the payout entry:
{ href: "/owner", label: t("owner.title") },
// Remove: { href: "/admin/payout", label: t("admin.sub_payout") },
```

Note: the `active` check for `/owner` needs `pathname.startsWith("/owner")` which the existing logic already handles because it uses `pathname.startsWith(item.href)` for non-root hrefs.

**Verify (manual):** Start dev server, log in as owner (non-admin), confirm `/admin/payout` redirects to `/owner`, and `/owner` tab appears in the admin nav.

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add app/admin/payout/page.tsx app/admin/layout.tsx
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "feat(owner): redirect /admin/payout → /owner, add to nav"
```

---

## Task 4 — Fleet overview (Screen 1): burden meter tiles

Implement `OwnerDashboard` in `app/owner/page.tsx`. This is Screen 1 of the design doc: one tile per car the logged-in user owns, showing the burden meter and break-even gap.

**Key data flow:**
- `useAdminSummary(year)` → `data.carPnL` (all cars)
- `useOwnerCarShorts()` → `Set<string> | null` (owner's car shorts, or null if admin)
- Filter `carPnL` to only the owner's cars (or all if admin)
- `beMetrics(car)` from `app/admin/_shared.tsx` for all calculations
- `useCars()` for `Car` metadata (needed for rate assistant in Task 6)

**Full implementation of `app/owner/page.tsx`:**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif, fmtMoney, fmtKm } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import {
  useAdminSummary,
  useOwnerCarShorts,
  beMetrics,
  Card,
  Row,
  Perf,
} from "@/app/admin/_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import type { CarPnL, MonthlyCarKm, PersonContribution, CarYearKm, CarPriceHistory } from "@/lib/queries/admin";
import type { Car } from "@/types";
import { useCars, useUpdateCar } from "@/hooks/use-cars";
import { CarBadge } from "@/components/car-badge";

// ── Screen state ─────────────────────────────────────────────
type Screen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number };

// ── Fleet tile ────────────────────────────────────────────────
function FleetTile({
  car,
  monthlyKm,
  onDetail,
  onRate,
  year,
}: {
  car: CarPnL;
  monthlyKm: MonthlyCarKm[];
  onDetail: () => void;
  onRate: () => void;
  year: number;
}) {
  const t = useT();
  const m = beMetrics(car);

  const statusColor =
    m.status === "ahead" ? paper.green : m.status === "on_pace" ? paper.amber : paper.accent;
  const statusLabel =
    m.status === "ahead"
      ? t("fleet.stamp_ahead")
      : m.status === "on_pace"
        ? t("fleet.stamp_on_pace")
        : t("fleet.stamp_behind");

  const meterPct = Math.min(1, m.pctCovered);
  const meterColor =
    m.status === "ahead" ? paper.green : m.status === "on_pace" ? paper.amber : paper.accent;

  return (
    <Card>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CarBadge short={car.car_short} />
          <div>
            <div style={{ fontFamily: fontSerif, fontSize: 18, fontWeight: 700, color: paper.ink, lineHeight: 1 }}>
              {car.car_name}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
              {car.car_short}
            </div>
          </div>
        </div>
        <div style={{
          padding: "4px 10px",
          border: `2px solid ${statusColor}`,
          color: statusColor,
          fontFamily: fontMono,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          transform: "rotate(-3deg)",
          opacity: 0.9,
          flexShrink: 0,
        }}>
          {statusLabel}
        </div>
      </div>

      {car.fixed_total > 0 ? (
        <>
          {/* Big number: remaining burden */}
          <div style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: statusColor, lineHeight: 1, margin: "8px 0 2px" }}>
            {fmtMoney(m.remainingBurden)}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 10 }}>
            {t("fleet.remaining_burden")} · {t("fleet.pct_covered", { pct: Math.round(m.pctCovered * 100) })}
          </div>

          {/* Burden meter */}
          <div style={{ height: 6, background: paper.paperDeep, position: "relative", marginBottom: 3 }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0,
              width: `${meterPct * 100}%`,
              background: meterColor,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 0.5, marginBottom: 10 }}>
            <span>{fmtMoney(car.fixed_total)} last</span>
            <span>break-even</span>
          </div>

          {/* Stats */}
          <Row label={t("fleet.coop_km_ytd")} value={fmtKm(car.trip_km)} />
          <Row label={t("fleet.break_even_km")} value={isFinite(m.breakEvenKm) ? fmtKm(m.breakEvenKm) : "—"} />
          {m.kmGap > 0 && (
            <Row
              label={t("fleet.km_gap")}
              value={isFinite(m.kmGap) ? fmtKm(m.kmGap) : "—"}
              color={paper.accent}
            />
          )}
          {car.prev_year_trip_km > 0 && (
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, marginTop: 4 }}>
              {t("fleet.prev_year_km", { km: car.prev_year_trip_km.toLocaleString("nl-BE") })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, padding: "8px 0" }}>
          {t("fleet.no_fixed")}
        </div>
      )}

      <Perf margin="12px 0 10px" />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDetail}
          style={{
            flex: 1, padding: "10px", background: paper.ink, color: paper.paper,
            border: "none", cursor: "pointer", fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
          }}
        >
          {t("fleet.see_breakeven")}
        </button>
        <button
          onClick={onRate}
          style={{
            flex: 1, padding: "10px", background: "transparent", color: paper.ink,
            border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
          }}
        >
          {t("rate.open")}
        </button>
      </div>
    </Card>
  );
}

// ── Owner dashboard ───────────────────────────────────────────
function OwnerDashboard() {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [screen, setScreen] = useState<Screen>({ view: "fleet" });

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data } = useAdminSummary(year);
  const ownerCarShorts = useOwnerCarShorts();
  const { data: cars = [] } = useCars();

  const allPnL = data?.carPnL ?? [];
  const monthlyKm = data?.monthlyCarKm ?? [];
  const contributions = data?.personContributions ?? [];
  const historicalKm = data?.historicalCarKm ?? [];
  const priceHistory = data?.priceHistory ?? [];

  // Filter to owner's cars (null = admin, sees all)
  const pnl = ownerCarShorts
    ? allPnL.filter((c) => ownerCarShorts.has(c.car_short))
    : allPnL.filter((c) => c.owner_name !== null);

  const carMap = new Map(cars.map((c) => [c.id, c]));

  // Back button resets to fleet
  if (screen.view === "detail") {
    // Import BreakEvenCard from admin/cars — see Task 5
    const car = pnl.find((c) => c.car_id === screen.carId);
    if (!car) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button
          onClick={() => setScreen({ view: "fleet" })}
          style={{
            marginBottom: 12, padding: "7px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
          }}
        >
          {t("owner.back_fleet")}
        </button>
        {/* BreakEvenCard is imported from admin/cars — Task 5 extracts it */}
        <BreakEvenCardShell
          car={car}
          fullCar={carMap.get(car.car_id)}
          monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
          contributions={contributions.filter((c) => c.car_id === car.car_id)}
          historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
          priceHistory={priceHistory.filter((h) => h.car_id === car.car_id)}
          year={year}
          onRateOpen={() => setScreen({ view: "rate", carId: car.car_id })}
        />
      </div>
    );
  }

  if (screen.view === "rate") {
    const car = pnl.find((c) => c.car_id === screen.carId);
    if (!car) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button
          onClick={() => setScreen({ view: "detail", carId: screen.carId })}
          style={{
            marginBottom: 12, padding: "7px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
          }}
        >
          ← {t("fleet.see_breakeven")}
        </button>
        <RateAssistantShell
          car={car}
          fullCar={carMap.get(car.car_id)}
          historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
          year={year}
          onCommit={() => setScreen({ view: "fleet" })}
        />
      </div>
    );
  }

  // ── Fleet view ──────────────────────────────────────────────
  return (
    <div style={{ padding: "16px" }}>
      {/* Year selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 16 }}>
        <button
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= earliestYear}
          style={{
            padding: "6px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, borderRight: "none",
            fontFamily: fontMono, fontSize: 10, fontWeight: 700,
            color: year <= earliestYear ? paper.inkMute : paper.ink,
            cursor: year <= earliestYear ? "default" : "pointer", letterSpacing: 1,
          }}
        >
          ← {year - 1}
        </button>
        <div style={{
          padding: "6px 18px", background: paper.ink, color: paper.paper,
          fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2,
          border: `1.5px solid ${paper.ink}`,
        }}>
          {year}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          style={{
            padding: "6px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, borderLeft: "none",
            fontFamily: fontMono, fontSize: 10, fontWeight: 700,
            color: year >= currentYear ? paper.inkMute : paper.ink,
            cursor: year >= currentYear ? "default" : "pointer", letterSpacing: 1,
          }}
        >
          {year + 1} →
        </button>
      </div>

      {pnl.length === 0 ? (
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, textAlign: "center", padding: "32px 0" }}>
          {t("owner.no_cars")}
        </div>
      ) : (
        pnl.map((car) => (
          <FleetTile
            key={car.car_id}
            car={car}
            monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
            onDetail={() => setScreen({ view: "detail", carId: car.car_id })}
            onRate={() => setScreen({ view: "rate", carId: car.car_id })}
            year={year}
          />
        ))
      )}
    </div>
  );
}

// ── Access guard ──────────────────────────────────────────────
export default function OwnerPage() {
  const { data: me, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && me && !me.isOwner && !me.isAdmin) {
      router.replace("/");
    }
  }, [me, isLoading, router]);

  if (isLoading || !me) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>…</div>
      </div>
    );
  }

  if (!me.isOwner && !me.isAdmin) return null;
  return <OwnerDashboard />;
}
```

**Note:** `BreakEvenCardShell` and `RateAssistantShell` are placeholder names for components extracted in Task 5.

**Verify:**
```bash
npx vitest run
# Expected: all unit tests pass
```

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add app/owner/page.tsx
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "feat(owner): Screen 1 — fleet overview tiles with burden meter"
```

---

## Task 5 — Extract shared components: BreakEvenCard and RateAssistant

The `BreakEvenCard` and rate assistant in `app/admin/cars/page.tsx` are fully-built and must be **reused** by `/owner`. Extract them into `components/break-even-card.tsx` and `components/rate-assistant.tsx` so both the admin cars page and the owner page import from the same place.

**Step 5a — Create `components/break-even-card.tsx`**

Move `BurdenCurve`, `ContributionLedger`, `PriceHistoryStrip`, and `BreakEvenCard` out of `app/admin/cars/page.tsx`. The component signature must accept an optional `onRateOpen` callback so the owner page can wire the "Raise rate" button to the rate assistant screen:

```typescript
// components/break-even-card.tsx
"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney, fmtKm } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-cars";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beMetrics, Card, Row, Perf } from "@/app/admin/_shared";
import type { CarPnL, MonthlyCarKm, PersonContribution, CarYearKm, CarPriceHistory } from "@/lib/queries/admin";
import type { Car } from "@/types";

// Re-export BurdenCurve, ContributionLedger, PriceHistoryStrip from the car page — exact copy:
// [paste exact code for BurdenCurve, ContributionLedger, PriceHistoryStrip from app/admin/cars/page.tsx]

export interface BreakEvenCardProps {
  car: CarPnL;
  fullCar: Car | undefined;
  monthlyKm: MonthlyCarKm[];
  contributions: PersonContribution[];
  historicalKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
  year: number;
  onRateOpen?: () => void; // optional: owner page passes this to navigate to rate screen
}

export function BreakEvenCard({
  car,
  fullCar,
  monthlyKm,
  contributions,
  historicalKm,
  priceHistory,
  year,
  onRateOpen,
}: BreakEvenCardProps) {
  // [exact copy of BreakEvenCard internals from app/admin/cars/page.tsx]
  // The only change: replace the inline "Raise rate" button onClick with onRateOpen?.()
  // when onRateOpen is provided; otherwise keep the existing showRate state toggle.
}
```

**Step 5b — Create `components/rate-assistant.tsx`**

Extract `RateAssistant` from `app/admin/cars/page.tsx` into its own component file:

```typescript
// components/rate-assistant.tsx
"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney, fmtKm } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-cars";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beMetrics, Card, Row, Perf } from "@/app/admin/_shared";
import type { CarPnL, CarYearKm } from "@/lib/queries/admin";
import type { Car } from "@/types";

export interface RateAssistantProps {
  car: CarPnL;
  fullCar: Car | undefined;
  historicalKm: CarYearKm[];
  year: number;
  onCommit?: () => void; // called after successful rate save
}

export function RateAssistant({ car, fullCar, historicalKm, year, onCommit }: RateAssistantProps) {
  // [exact copy of RateAssistant internals from app/admin/cars/page.tsx]
  // The only change: call onCommit?.() after successful mutate in handleCommitRate
}
```

**Step 5c — Update `app/admin/cars/page.tsx` to import from the new components**

Replace the inlined `BreakEvenCard` and `RateAssistant` with imports:

```typescript
// app/admin/cars/page.tsx — replace inline definitions with:
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";
```

**Step 5d — Update `app/owner/page.tsx` to use real components**

Replace `BreakEvenCardShell` and `RateAssistantShell` with real imports:

```typescript
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";
```

And in the render for `screen.view === "detail"`:
```typescript
<BreakEvenCard
  car={car}
  fullCar={carMap.get(car.car_id)}
  monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
  contributions={contributions.filter((c) => c.car_id === car.car_id)}
  historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
  priceHistory={priceHistory.filter((h) => h.car_id === car.car_id)}
  year={year}
  onRateOpen={() => setScreen({ view: "rate", carId: car.car_id })}
/>
```

And for `screen.view === "rate"`:
```typescript
<RateAssistant
  car={car}
  fullCar={carMap.get(car.car_id)}
  historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
  year={year}
  onCommit={() => setScreen({ view: "fleet" })}
/>
```

**Verify:**
```bash
npx vitest run
# Expected: all tests pass (no regressions)
# Also check TypeScript:
npx tsc --noEmit
# Expected: 0 errors
```

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add \
  components/break-even-card.tsx \
  components/rate-assistant.tsx \
  app/admin/cars/page.tsx \
  app/owner/page.tsx
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "refactor: extract BreakEvenCard and RateAssistant as shared components"
```

---

## Task 6 — Unit tests for break-even math

Write vitest unit tests covering the `beMetrics` function and the co-op km filtering logic. These tests document the expected math and serve as a safety net for future changes.

**File:** `lib/__tests__/break_even.test.ts`

```typescript
// lib/__tests__/break_even.test.ts
import { describe, it, expect } from "vitest";
import { beMetrics } from "@/app/admin/_shared";
import type { CarPnL } from "@/lib/queries/admin";

function makeCar(overrides: Partial<CarPnL> = {}): CarPnL {
  return {
    car_id: 1,
    car_short: "ETH",
    car_name: "Ethel",
    car_price_per_km: 0.23,
    owner_name: "Malvina",
    long_threshold: 500,
    fixed_costs: [{ id: "1", category: "verzekeringen", description: "ins", amount: 2640 }],
    expected_km: null,
    trip_count: 100,
    trip_km: 6800,
    trip_revenue: 6800 * 0.23,
    owner_trip_amount: 0,
    fuel_count: 20,
    fuel_amount: 816,           // 6800 km * €0.12
    expense_count: 5,
    expense_amount: 0,
    fixed_total: 2640,
    variable_total: 816,
    total_cost: 816 + 2640,
    net_to_owner: 6800 * 0.23 - (816 + 2640),
    cost_per_km: (816 + 2640) / 6800,
    prev_year_trip_km: 5940,
    ...overrides,
  };
}

describe("beMetrics", () => {
  it("computes variable cost per km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // variable_total = 816, trip_km = 6800 → 816/6800 ≈ 0.12
    expect(m.variablePerKm).toBeCloseTo(0.12, 2);
  });

  it("computes contribution per km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 0.23 − 0.12 = 0.11
    expect(m.contribPerKm).toBeCloseTo(0.11, 2);
  });

  it("computes fixed cost recovery correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // trip_revenue - variable_total = 6800*0.23 - 816 = 1564 - 816 = 748
    expect(m.fixedCovered).toBeCloseTo(748, 0);
  });

  it("computes remaining burden correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 2640 - 748 = 1892
    expect(m.remainingBurden).toBeCloseTo(1892, 0);
  });

  it("computes break-even km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 2640 / 0.11 ≈ 24000
    expect(m.breakEvenKm).toBeCloseTo(24000, -2);
  });

  it("computes km gap correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 24000 - 6800 ≈ 17200
    expect(m.kmGap).toBeCloseTo(17200, -2);
  });

  it("status is 'behind' when pctProjected < 0.85", () => {
    const car = makeCar();
    const m = beMetrics(car);
    expect(m.status).toBe("behind");
  });

  it("status is 'ahead' when fixedCovered >= fixed_total", () => {
    // Simulate a car that has fully covered its fixed costs
    const car = makeCar({ trip_km: 30000, trip_revenue: 30000 * 0.23, variable_total: 30000 * 0.12, fuel_amount: 30000 * 0.12, expense_amount: 0 });
    const m = beMetrics(car);
    expect(m.status).toBe("ahead");
    expect(m.remainingBurden).toBe(0);
  });

  it("handles zero fixed costs gracefully", () => {
    const car = makeCar({ fixed_total: 0, fixed_costs: [] });
    const m = beMetrics(car);
    expect(m.remainingBurden).toBe(0);
    expect(m.pctCovered).toBe(1);
    expect(m.breakEvenKm).toBe(Infinity);
  });

  it("handles zero trip_km gracefully (no division by zero)", () => {
    const car = makeCar({ trip_km: 0, trip_revenue: 0, variable_total: 0, fuel_amount: 0 });
    const m = beMetrics(car);
    expect(m.variablePerKm).toBe(0);
  });
});
```

**Run:**
```bash
npx vitest run lib/__tests__/break_even.test.ts
# Expected: 9 tests pass
```

**Commit:**
```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 add lib/__tests__/break_even.test.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 commit -m "test(owner): unit tests for beMetrics break-even math"
```

---

## Task 7 — Quality check and lint

Run the full test suite and TypeScript compiler to ensure no regressions before integration.

```bash
# From worktree root:
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 && npx vitest run)
# Expected: all tests pass

(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 && npx tsc --noEmit)
# Expected: 0 errors

(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 && npx eslint app/owner/ components/break-even-card.tsx components/rate-assistant.tsx --max-warnings 0)
# Expected: 0 warnings
```

If any lint errors appear, fix them before proceeding. Common issues:
- Unused variables from extracting components
- Missing `key` props in mapped lists
- `any` types introduced during extraction

**Commit:** No code change — this is a verification step only.

---

## Task 8 — Manual smoke test checklist

Start the dev server and walk through these scenarios:

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 && npm run dev -- --port 3002) &
# Wait for "ready" message, then:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002
# Expected: 200
```

**Smoke tests (do manually in browser):**

- [ ] Log in as a non-owner member → `/owner` redirects to `/` → admin tab is not shown in bottom bar
- [ ] Log in as an owner (non-admin) → `/owner` shows the fleet overview with their cars only → admin tab IS shown in bottom bar
- [ ] Owner sees burden meter tiles for each of their owned cars
- [ ] Tapping "Break-even →" on a tile navigates to break-even detail screen
- [ ] Back button returns to fleet overview
- [ ] Tapping "Raise rate" / `rate.open` button navigates to rate assistant screen
- [ ] Rate assistant "Commit" button saves and returns to fleet view
- [ ] Navigating to `/admin/payout` redirects to `/owner`
- [ ] Log in as admin → `/owner` shows ALL cars with owners (no filter)
- [ ] Admin still sees `/admin/cars` with BreakEvenCard working as before (no regression)
- [ ] Year switcher works correctly on the fleet view
- [ ] Cars with `fixed_total = 0` show "Geen vaste kosten" (no crash, no NaN)

---

## Task 9 — Commit final state

After all checks pass:

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 status
# Verify no untracked or uncommitted files

git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-88 log --oneline -8
# Verify all commits are present
```

---

## Architecture decisions record

### Why not create a new `/api/owner/...` route?

The existing `/api/admin/summary` returns `CarPnL[]` which already contains all the break-even inputs: `fixed_total`, `variable_total`, `trip_km`, `trip_revenue`, `owner_trip_amount`, `prev_year_trip_km`, plus `historicalCarKm` and `personContributions`. Creating a new endpoint would duplicate this work. Instead, the `/owner` page fetches the same endpoint and filters client-side by the owner's car shorts (via `useOwnerCarShorts()`). The auth guard on the endpoint (`requireAdminOrOwner`) ensures non-owners cannot call it.

### Why extract components rather than import across page boundaries?

Next.js App Router does not prohibit cross-page imports, but components in `app/admin/cars/page.tsx` are not exported — they are only in the module scope of that file. To reuse them, they must be moved to `components/`. This is the standard pattern in this codebase (see `components/car-badge.tsx`, `components/page-header.tsx`, etc.).

### Why no new database migration?

All required data is already in the schema: `cars.fixed_costs_json`, `cars.price_per_km`, `cars.expected_km`, `cars.owner_name`, `trips`, `fuel_fillups`. No new columns are needed.

### Why no new query file `lib/queries/break-even.ts`?

`getCarPnL()` in `lib/queries/admin.ts` already computes all required aggregates. The break-even math (`beMetrics`) is pure arithmetic in `app/admin/_shared.tsx`. No SQL changes are required.

### Owner detection: session vs. DB

`isOwner` is checked at the `/api/me` endpoint via `lib/queries/people.isOwner()` (counts active cars with `owner_name` matching the session). This is already correct. The client-side `me.isOwner` boolean is used to show/hide UI. The server-side `requireAdminOrOwner` checks the DB at request time for API protection.

### What happens to `/admin/payout`?

The page content is replaced with a client-side redirect to `/owner`. The route continues to exist (no 404 for bookmarks), but the economics content moves entirely to `/owner`. The settlement amounts (S₁, S₂, transfers) remain on `/admin/settlement` and are not touched by this change.
