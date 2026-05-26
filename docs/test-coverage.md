# Test Coverage Overview

Generated for issue #224. Last updated: 2026-05-27.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Covered — unit + e2e (where applicable) |
| ⚠️ | Partial — some operations or layers missing |
| ❌ | Missing — no test at any level |

---

## CRUD Entities

| Feature | Test file(s) | CRUD ops covered | Status |
|---|---|---|---|
| **Trips** | `lib/__tests__/queries_trips.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/trips.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e, R: unit, U: unit (conflict/no-conflict), D: unit+e2e | ✅ |
| **Fuel fill-ups** | `lib/__tests__/queries_fuel_fillups.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/fuel.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e (price_per_liter auto-compute, idempotency), R: unit, U: unit (all fields + conflict), D: unit+e2e | ✅ |
| **Expenses** | `lib/__tests__/queries_expenses.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/expenses.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e (category, settled_outside, idempotency), R: unit, U: unit (conflict), D: unit+e2e | ✅ |
| **Payments** | `lib/__tests__/queries_payments.test.ts`, `lib/__tests__/schemas_payment.test.ts`, `e2e/cache-invalidation.spec.ts` | C: unit+e2e (create+list), R: unit, U: unit, D: unit; e2e: no update/delete | ⚠️ |
| **People / members** | `lib/__tests__/queries_people.test.ts` | C: unit, R: unit (all/active/byId/byUsername), U: unit (username, theme); D: missing at all layers | ⚠️ |
| **Cars / vehicles** | `lib/__tests__/queries_cars.test.ts` | C: unit (price history, owner), R: unit, U: unit (price history delta), D: unit (FK); no e2e | ⚠️ |
| **Settlements** | `lib/__tests__/settlement.test.ts` | getSettlement: full unit (cross-car, own-car, fuel credits, payment status); lock/unlock: unit; e2e: a11y only, no functional assertions | ⚠️ |
| **Reservations / calendar** | `lib/__tests__/queries_reservations.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/reservations.spec.ts`, `e2e/cache-invalidation.spec.ts` | C: unit+e2e, R: unit, U: unit (conflict), D: unit; status update: unit+e2e | ✅ |

---

## Beyond CRUD

| Feature | Test file(s) | What's covered | Status |
|---|---|---|---|
| **Settlement math — formulas** | `lib/__tests__/formulas.test.ts` | calcTripAmount (discount tiers, boundaries), calcPricePerLiter, calcPaymentYear | ✅ |
| **Settlement math — N/S1/S2/cross-car/own-car** | `lib/__tests__/settlement.test.ts` | N_new, S1, S2, s1_cross, net, transfers (step 1+2), car_settlements, fuel credit | ✅ |
| **Settlement lines (UI structure)** | `lib/__tests__/settlement_lines.test.ts` | Non-owner no payment, partial, net>0, two-car eras, settled-outside notes, owner section | ✅ |
| **Settlement message (text output)** | `lib/__tests__/settlement_message.test.ts` | No payment / partial / overpaid / negative alreadyPaid / net>0 | ✅ |
| **Break-even / admin PnL** | `lib/__tests__/break_even.test.ts` | beMetrics: net, pctCovered, status (ahead/behind) | ✅ |
| **Auth — verifyCredentials** | `lib/__tests__/auth.test.ts` | Correct match, wrong username, wrong password, empty password | ✅ |
| **Auth — login flow (UI)** | `e2e/smoke.spec.ts` | Form-fill login + redirect | ✅ |
| **Auth — invite flow** | `lib/__tests__/queries_people.test.ts` | Token create/read/delete/upsert; no e2e for invite-accept UI | ⚠️ |
| **Auth — password change** | — | Not tested at any level | ❌ |
| **Auth — cloak / uncloak (admin impersonation)** | — | Not tested at any level | ❌ |
| **Auth — logout** | — | Not tested at any level | ❌ |
| **Offline — outbox (IndexedDB)** | `lib/offline/outbox.test.ts` | enqueue, list, peek, remove, count, clearAll, FIFO order | ✅ |
| **Offline — drain engine** | `lib/offline/sync-engine.test.ts` | Drain on 201, stop on 5xx, drop 409+continue, network abort | ✅ |
| **Offline — optimistic UI** | `lib/offline/optimistic.test.ts` | applyCreate, replaceCreate, rollbackCreate, applyUpdate, applyDelete | ✅ |
| **Offline — online state** | `lib/offline/online-state.test.ts` | computeStaleness: fresh/stale/unknown/boundary | ✅ |
| **Offline — prewarm** | `lib/offline/prewarm.test.ts` | prewarmCriticalEndpoints (parallel, failure tolerance), prewarmPages | ✅ |
| **Offline badge (e2e)** | `e2e/smoke.spec.ts` | Offline event → badge appears | ✅ |
| **Admin — car P&L queries** | `lib/__tests__/queries_admin.test.ts` | getCarPnL, getMonthlyCarKm, getPersonContributions, getHistoricalCarKm, getPriceHistory, getZeroKmTrips, getKmGaps (gap detection, ≤1km tolerance), getRollingFuelPerKm, getHistoricalOwnerSplit, getHistoricalExpenses | ✅ |
| **Admin — skeleton loading states** | `e2e/admin-skeleton.spec.ts` | Inbox skeleton, gaps skeleton, no spinner | ✅ |
| **Admin — calendar renew + delta sync** | `lib/__tests__/calendar_renew.test.ts` | Skip-disabled, not-due+delta, 410 recovery, renew<5d, initial-setup, non-410 throws | ✅ |
| **Admin — reservation ↔ Google Calendar sync** | `lib/__tests__/reservation_sync.test.ts` | syncCreate/Update/Delete → Google Calendar API | ✅ |
| **Admin — calendar delta processing** | `lib/__tests__/process_calendar_delta.test.ts` | Skip unknown, skip echo (etag+nonce), overwrite time edit, confirm/reject on RSVP, cancelled=rejected | ✅ |
| **Admin — calendar backfill** | — | `POST /api/admin/calendar-backfill` untested | ❌ |
| **Admin settings** | `lib/__tests__/queries_settings.test.ts` | get (missing/existing), set (create/upsert/multi) | ✅ |
| **Form validation — decimal input** | `lib/__tests__/form-decimal.test.ts` | period/comma/integer/empty/non-numeric/passthrough/positive check | ✅ |
| **Form validation — payment schema** | `lib/__tests__/schemas_payment.test.ts` | Positive/negative amount, zero rejected, missing amount rejected | ✅ |
| **API helpers** | `lib/__tests__/api_helpers.test.ts`, `lib/__tests__/api.test.ts` | HttpError, notFound/badRequest/forbidden, readBody, readId, canEdit | ✅ |
| **API route coverage** | `app/api/health/route.test.ts` | Only `/api/health` has a co-located test; all other 37 routes untested at HTTP layer | ❌ |
| **Dashboard queries** | `lib/__tests__/queries.test.ts` | getDashboard (zero/negative balance, year filter, payments, expense_count, settled_outside), getLastCarState | ✅ |
| **Migrations — 0003** | `lib/__tests__/migration_0003.test.ts` | client_id/updated_at columns, UNIQUE constraint, defaults | ✅ |
| **Migrations — 0004 + 0005** | `lib/__tests__/migration_0004.test.ts` | owner_from/owner_to backfill, settlements table | ✅ |
| **Migrations — 0011–0014** | `lib/__tests__/migration_0011_to_0014.test.ts` | email, owner_person_id, 4 calendar columns, calendar_sync_state | ✅ |
| **Migrations — 0018** | `lib/__tests__/migration_0018.test.ts` | theme_preference column, 'paper' default | ✅ |
| **Migrations — 0006–0010, 0015–0017, 0020** | — | Not individually tested (exercised implicitly by `runMigrations` in every unit test) | ⚠️ |
| **Full schema** | `lib/__tests__/db.test.ts` | All 13 tables, FK enforcement, migration log, idempotency | ✅ |
| **Cache invalidation** | `e2e/cache-invalidation.spec.ts` | Reservation + payment appear without reload | ✅ |
| **Direct URL edit close behavior** | `e2e/direct-url-edit.spec.ts` | Close stays on /trips, save closes+stays on /trips | ✅ |
| **Accessibility** | `e2e/a11y-audit.spec.ts` | 16 routes audited: login, /trips, /expenses, /fuel, /vehicles, /calendar, /payments, /people, /owner, /admin, /admin/members, /admin/payments, /admin/payout, /admin/settings, /admin/settlement, /admin/vehicles | ✅ |
| **i18n** | `lib/__tests__/i18n.test.ts` | Known key, placeholder substitution, numeric params, missing param fallback | ✅ |
| **Person name utilities** | `lib/__tests__/person_utils.test.ts` | shortNameOf, fullNameOf | ✅ |
| **Paper theme / formatting** | `lib/__tests__/paper_theme.test.ts` | CSS vars, fmtMoney, fmtKm, fmtDate, fmtYearMonth, amtColor, signPrefix | ✅ |
| **UUID generation** | `lib/__tests__/uuid.test.ts`, `lib/offline/uuid.test.ts` | RFC4122 v4 shape, uniqueness, fallback | ✅ |
| **Google Calendar addDays** | `lib/__tests__/google_calendar.test.ts` | Day/month/year/leap-year boundaries | ✅ |

---

## API Routes Without Tests

All `app/api/**/route.ts` files except `/api/health` have no co-located test:

```
app/api/trips/route.ts                      app/api/trips/[id]/route.ts
app/api/fuel/route.ts                       app/api/fuel/[id]/route.ts
app/api/expenses/route.ts                   app/api/expenses/[id]/route.ts
app/api/payments/route.ts                   app/api/payments/[id]/route.ts
app/api/reservations/route.ts               app/api/reservations/[id]/route.ts
app/api/reservations/[id]/status/route.ts
app/api/vehicles/route.ts                   app/api/vehicles/[id]/route.ts
app/api/vehicles/[id]/last-state/route.ts
app/api/people/route.ts                     app/api/people/[id]/route.ts
app/api/people/[id]/profile/route.ts        app/api/people/[id]/invite/route.ts
app/api/auth/login/route.ts                 app/api/auth/logout/route.ts
app/api/auth/cloak/route.ts                 app/api/auth/uncloak/route.ts
app/api/settlement/[year]/route.ts
app/api/invite/[token]/route.ts
app/api/me/route.ts
app/api/calendar-id/route.ts                app/api/calendar-webhook/route.ts
app/api/admin/settings/route.ts             app/api/admin/summary/route.ts
app/api/admin/calendar-backfill/route.ts    app/api/admin/calendar-renew/route.ts
app/api/admin/calendar-test/route.ts
app/api/dashboard/route.ts                  app/api/dashboard/earliest-year/route.ts
app/api/docs/route.ts
app/api/static/[...path]/route.ts
app/api/uploads/route.ts
```

---

## Gap Summary

| # | Gap | Severity | Related issue |
|---|-----|----------|---------------|
| 1 | Auth: password change — no API or e2e test | High | #256 |
| 2 | Auth: cloak/uncloak — security feature, zero test coverage | High | #256 |
| 3 | Auth: logout — no test | Medium | #256 |
| 4 | People: delete/deactivate — missing at all layers | Medium | #257 |
| 5 | Cars/vehicles: no e2e CRUD | Medium | #257 |
| 6 | Payments: no e2e for update/delete | Low | #257 |
| 7 | Settlement: no functional e2e (lock/finalize/messages) | Medium | #257 |
| 8 | Invite flow: no e2e for accept + set password | Medium | #257 |
| 9 | API route error cases: 37 of 38 routes untested at HTTP layer | High | #258 |
| 10 | Admin: calendar backfill — no test | Low | #259 |
