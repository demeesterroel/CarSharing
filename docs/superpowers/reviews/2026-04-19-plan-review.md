# CarSharing Plan Review — 2026-04-19

**Reviewer:** Claude (continuation session, Sonnet 4.6)
**Scope:** All 10 implementation plans + seed sub-plan + NAMING.md.
**Outcome:** Critical fixes applied in-place; one new plan added (`plan-00-shared-helpers.md`); several plans renamed to match English naming.

---

## Summary

The plans were internally inconsistent: plans 02/02b/03/10 and NAMING.md adopt English identifiers across the codebase (`trips`, `fuel_fillups`, `calcTripAmount`, `discount`, `price_per_km`, …), but plans 04–09 were still written against the old Dutch vocabulary (`ritten`, `tankbeurten`, `calcBedrag`, `korting`, `prijs`, …). An agent executing the plans top-to-bottom would hit a type error at the first cross-plan call site.

The second systemic issue is Next.js 15 compatibility: every `app/api/*/[id]/route.ts` destructures `params` synchronously, which Next 15 no longer supports — `params` is now a `Promise`. `next-pwa` (the PWA package pinned in plan-01) also has not been updated for Next 15 / React 19.

Neither issue is visible until the code runs, so the plans *look* coherent when skimmed.

---

## Critical issues (correctness blockers)

### 1. Dutch/English split across plans 04–09
**Impact:** Runtime + type errors. Execution-blocking.

| Plan | Uses Dutch | Should be (per NAMING.md) |
|---|---|---|
| 04 NavDrawer | `/ritten`, `/tanken`, `/kosten`, `/betaald` | `/trips`, `/fuel`, `/expenses`, `/payments` |
| 05 people/cars forms | `korting`, `korting_long`, `prijs`, `merk`, `kleur` | `discount`, `discount_long`, `price_per_km`, `brand`, `color` |
| 06 ritten | table `ritten`, columns `datum/start/eind/bedrag/locatie`, type `Rit`, helper `calcBedrag` | `trips`, `date/start_odometer/end_odometer/amount/location`, `Trip`, `calcTripAmount` |
| 07 tanken | table `tankbeurten`, columns `bedrag/liter/prijs_liter/kilometerstand/bonnetje` | `fuel_fillups`, `amount/liters/price_per_liter/odometer/receipt` |
| 08 kosten/betaald | tables `kosten/betaald`, columns `datum/bedrag/omschrijving/opmerking` | `expenses/payments`, `date/amount/description/note`, helper `calcPaymentYear` |
| 09 dashboard | queries against `ritten/tankbeurten/kosten/betaald` with Dutch column names | `trips/fuel_fillups/expenses/payments` with English columns |

**Fix:** Full rewrites of plans 04–09 against NAMING.md. Plans 06/07/08 renamed to `plan-06-trips.md`, `plan-07-fuel.md`, `plan-08-expenses-payments.md`.

### 2. Next.js 15 dynamic route params are Promises
**Impact:** Type errors on every `app/api/*/[id]/route.ts` in plans 05–09.

```ts
// Wrong (Next 14 style — plans shipped this)
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const row = getById(getDb(), Number(params.id));
}

// Correct (Next 15)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getById(getDb(), Number(id));
}
```

**Fix:** Every dynamic route signature updated across plans 05–09.

### 3. `themeColor` in the `metadata` export
**Impact:** Build-time warning in Next 14+; silently dropped from HTML in some configs.

`themeColor` must now live on the `viewport` export (not `metadata`). Plan 01 had it in metadata; plan 10 correctly moves it. Aligned plan 01 to the same shape plan 10 uses so the two plans don't contradict each other.

### 4. `next-pwa` is not compatible with Next 15 / React 19
**Impact:** Plan 10's service worker step fails at `npm run build`.

The upstream `next-pwa` package (shadowwalker/next-pwa) stopped at Next 13. For Next 15, the community fork `@ducanh2912/next-pwa` is the drop-in replacement; Serwist is a larger migration but more future-proof.

**Fix:** Plan 10 switched to `@ducanh2912/next-pwa`. Plan 01's dependency list updated to match. (Serwist migration noted in plan-10 as a later-phase option.)

### 5. `<link rel="stylesheet">` rendered inside `<div>` (plan 06 location-picker)
**Impact:** Invalid HTML; Leaflet map CSS may not load depending on React's hoisting behavior. React 19 hoists `<link>` and `<title>` to `<head>` automatically, so in practice this works — but it's fragile and not documented. Moving the Leaflet stylesheet import to `app/layout.tsx` via `<link>` in the root `<head>` makes it explicit.

**Fix:** Moved Leaflet CSS + fonts to `app/layout.tsx`. `location-picker.tsx` no longer emits `<link>`.

### 6. FullCalendar end-date is exclusive (plan 09)
**Impact:** A reservation from 2026-04-18 to 2026-04-20 renders as occupying only Apr 18–19 (not Apr 20). Off-by-one against user expectations.

**Fix:** In the event mapper, add one day to `r.end_date` before passing to FullCalendar:
```ts
const end = new Date(r.end_date); end.setDate(end.getDate() + 1);
```
This matches how the AppSheet original behaves (end date inclusive).

### 7. Dashboard query is O(people × 4) SQL round-trips
**Impact:** With 24 people and yearly views, that's 96 round-trips per dashboard load. Functional, but wasteful.

**Fix:** Four `GROUP BY person_id` queries total (one per source table), then a JOIN-in-memory pass. Plan 09 rewritten to do this.

### 8. Seed script non-idempotent for transactional tables
**Impact:** Re-running `npm run seed` duplicates every trip, fill-up, expense, and payment. Only `cars` and `people` use `INSERT OR IGNORE`.

**Fix:** Plan 02b updated to wipe the 4 transactional tables inside the seed transaction before inserting, and a `--fresh` flag documented. Safer than adding composite uniqueness constraints to user data.

### 9. Dockerfile installs production-only deps then tries to build
**Impact:** `npm ci --omit=dev` in the `deps` stage excludes `typescript`, `tailwindcss`, `vitest`, etc. — then `npm run build` in the `builder` stage fails.

**Fix:** Plan 10's Dockerfile uses `npm ci` (all deps) in the builder stage and only copies `node_modules` from a separate production-deps stage into the runner. The runner stage no longer needs `python3/make/g++` — those are build-time only; pre-built `better-sqlite3` binaries are used at runtime. Saves ~80MB.

### 10. Seed ignores `Manueel bedrag` override for trips
**Impact:** Historical trips where the user manually overrode the computed amount lose that override when re-seeded.

**Fix:** Plan 02b already had this guard — verified it's correct. Left as-is.

---

## Quality improvements (not blockers)

### 11. API boilerplate duplication
Every `route.ts` has the same try-nothing / no-validation / cast-to-`any` shape:
```ts
const body = await req.json();
insert(getDb(), { a: body.a, b: body.b, ... });
return NextResponse.json({ id }, { status: 201 });
```
Every hook has the same `fetch()`-and-invalidate pattern.

**Fix:** New `plan-00-shared-helpers.md`:
- `lib/api.ts` exports `json(handler)` — wraps any handler with unified error → JSON response and Zod body-parsing.
- `hooks/use-resource.ts` exports a `createResourceHooks<T, TInput>(key, path)` factory. Six CRUD hook files now shrink from ~30 lines each to ~6.

### 12. No pagination on trip list
Year 2026 alone has ~2000 trips. Infinite scrolling / pagination is not in this phase, but the list should at minimum fetch only the current month by default. Documented as a `Phase 2` item in plan-06; not implemented yet (YAGNI — the data volume is trivial for now).

### 13. File upload has no size / MIME cap
Plan 07's `/api/uploads` accepts any file up to Next's default body limit (~4MB with App Router). Added a 8MB size gate and MIME-type check (`image/jpeg`, `image/png`, `image/webp`) to plan 07.

### 14. `const [client] = useState(() => new QueryClient())` is correct
Flagged during review but this is the idiomatic Next.js pattern for QueryClient in a "use client" Provider — not a bug.

### 15. Cars page shows `c.merk · c.kleur · €{c.prijs}/km` in JSX
Bug: property names are Dutch but the `Car` type has English fields. Fixed as part of the plan-05 rewrite.

---

## What I *didn't* change

- **Kept Dutch UI labels.** The user-facing strings (`"Tanken"`, `"Kilometers"`, `"Naam"`, `"Bedrag"`, button labels like `"Opslaan"`) stay in Dutch — that's a deliberate product decision documented in NAMING.md ("UI labels — kept for users"). Only code identifiers became English.
- **Kept component file/folder names in English** (`trip-form.tsx`, `fuel-form.tsx`) per NAMING.md. The AppSheet screenshot labels still say `"Tanken"` etc. — that's fine, the label is a string the form renders.
- **No auth layer.** The spec says single-user phase 1; auth is deferred. Not adding middleware.
- **No offline-sync queue yet.** PWA scope in plan-10 is install + offline cache. Mutation replay / IndexedDB queue was in the design doc but no plan implements it — flagged as Phase 2 in the review (not written as a plan task yet because brainstorming didn't lock the approach).
- **No tests added for pages/hooks.** Vitest only covers `lib/formulas.ts` and `lib/queries/*`. Adding RTL/Playwright tests for every form was out of scope per the original spec. Left as-is.

---

## Final screen inventory

Eight screens ship in phase 1. All are mobile-first (max-width 2xl container on desktop).

| # | Route | Title (Dutch UI) | Purpose | Key interactions |
|---|---|---|---|---|
| 1 | `/` | Dashboard | Per-person year balance with ▲/▼/= indicator | Year picker ±; tap person → drill-down (phase 2) |
| 2 | `/calendar` | Calendar | FullCalendar month/week/day view of reservations | FAB add; tap event to edit/delete; drag-create (phase 2) |
| 3 | `/trips` | Kilometers | Month-grouped list of trips with total km per group | FAB add; tap row to edit/delete; auto-calc km+amount in form; GPS + map |
| 4 | `/fuel` | Tanken | Month-grouped list of fuel fill-ups with total € per group | FAB add; tap row to edit/delete; auto-calc €/L; receipt photo upload |
| 5 | `/expenses` | Extra Kosten | Month-grouped list of maintenance/tax expenses with total € | FAB add; tap row to edit/delete |
| 6 | `/payments` | Betalingen | Flat list of settlement payments with year badge | FAB add; tap row to edit/delete; auto-compute `year = date-year − 1` |
| 7 | `/people` | People | Active/inactive people with discount info | FAB add; tap row to edit; active dot |
| 8 | `/cars` | Cars | Car list with short code, brand, color, price/km | FAB add; tap row to edit |

All eight share: `PageHeader` with hamburger → `NavDrawer`, floating `Fab` for primary action, bottom-sheet `<Dialog>` for add/edit forms. All eight read via TanStack Query and invalidate on mutate.

---

## Files changed in this review

```
docs/superpowers/plans/
  NAMING.md                        (unchanged — source of truth)
  plan-00-shared-helpers.md        (NEW)
  plan-01-scaffold.md              (themeColor + @ducanh2912/next-pwa)
  plan-02-database.md              (unchanged)
  plan-02b-seed.md                 (idempotent wipe)
  plan-03-types.md                 (unchanged)
  plan-04-components.md            (English routes in NavDrawer)
  plan-05-people-cars.md           (English fields, Next 15 params, Zod+json wrapper)
  plan-06-trips.md                 (renamed from ritten; English, location-picker CSS fix)
  plan-07-fuel.md                  (renamed from tanken; English, upload size cap)
  plan-08-expenses-payments.md     (renamed from kosten-betaald; English, cleanup)
  plan-09-calendar-dashboard.md    (English, 4-query dashboard, FullCalendar end+1)
  plan-10-pwa-docker.md            (@ducanh2912/next-pwa, slimmer Dockerfile)

docs/superpowers/reviews/
  2026-04-19-plan-review.md        (this file)
```
