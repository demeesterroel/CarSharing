# Test Coverage Overview

Generated for issue #224. Last updated: 2026-06-02.

**Totals:** 67 unit test files / 547 tests · 16 e2e specs / 53 cases · 15 of 44 API routes have an HTTP-layer test.

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
| **Trips** | `lib/__tests__/queries_trips.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/trips.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e, R: unit+e2e (dashboard km), U: unit (conflict/no-conflict), D: unit+e2e | ✅ |
| **Fuel fill-ups** | `lib/__tests__/queries_fuel_fillups.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/fuel.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e (price_per_liter auto-compute, idempotency), R: unit, U: unit (all fields + conflict), D: unit+e2e | ✅ |
| **Expenses** | `lib/__tests__/queries_expenses.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `e2e/expenses.spec.ts`, `e2e/direct-url-edit.spec.ts` | C: unit+e2e (category, settled_outside, idempotency), R: unit, U: unit (conflict), D: unit+e2e | ✅ |
| **Payments** | `lib/__tests__/queries_payments.test.ts`, `lib/__tests__/schemas_payment.test.ts`, `app/api/payments/route.test.ts`, `e2e/payments.spec.ts`, `e2e/cache-invalidation.spec.ts` | C: unit+route+e2e, R: unit, U: unit+e2e (PUT), D: unit+e2e (DELETE) | ✅ |
| **People / members** | `lib/__tests__/queries_people.test.ts`, `app/api/people/[id]/profile/route.test.ts`, `app/api/people/[id]/revoke-sessions/route.test.ts`, `e2e/members.spec.ts` | C: unit+e2e, R: unit+e2e, U: unit (username, theme, profile route); D/deactivate: e2e (deactivate + still API-retrievable) | ✅ |
| **Cars / vehicles** | `lib/__tests__/queries_cars.test.ts`, `e2e/vehicles.spec.ts` | C: unit+e2e (price history, owner), R: unit+e2e, U: unit+e2e (PUT name, price delta), D: unit+e2e (FK) | ✅ |
| **Settlements** | `lib/__tests__/settlement.test.ts`, `e2e/settlement.spec.ts` | getSettlement: full unit (cross-car, own-car, fuel credits, payment status); lock/unlock: unit **+ e2e (freeze/unfreeze)** | ✅ |
| **Reservations / calendar** | `lib/__tests__/queries_reservations.test.ts`, `lib/__tests__/api_idempotency.test.ts`, `app/api/reservations/[id]/status/route.test.ts`, `e2e/reservations.spec.ts`, `e2e/cache-invalidation.spec.ts` | C: unit+e2e, R: unit, U: unit (conflict), D: unit; status update: unit+route+e2e | ✅ |

---

## Auth & Sessions

| Feature | Test file(s) | What's covered | Status |
|---|---|---|---|
| **verifyCredentials** | `lib/__tests__/auth.test.ts` | Correct match, wrong username, wrong password, empty password (timing-safe) | ✅ |
| **Login (route + UI)** | `app/api/auth/login/route.test.ts`, `e2e/smoke.spec.ts` | Credential check, rate-limit, env fallback; form-fill login + redirect | ✅ |
| **Logout / logout-all** | `app/api/auth/logout/route.test.ts`, `app/api/auth/logout-all/route.test.ts`, `e2e/session-revocation.spec.ts` | Logout clears session; logout-all bumps epoch; CSRF required | ✅ |
| **Session revocation (#266)** | `lib/__tests__/session_epoch.test.ts`, `app/api/people/[id]/revoke-sessions/route.test.ts`, `e2e/session-revocation.spec.ts` | Epoch mismatch → 403; admin revoke; revoke across two devices | ✅ |
| **Cloak / uncloak (admin impersonation)** | `app/api/auth/cloak/route.test.ts`, `app/api/auth/uncloak/route.test.ts` | Enter/exit impersonation, admin-only, identity swap in `/api/me` | ✅ |
| **Password reset (forgot + reset)** | `app/api/auth/forgot/route.test.ts`, `app/api/auth/reset/[token]/route.test.ts`, `e2e/auth-recovery.spec.ts` | Token create + send, no enumeration, invalid/expired token, guest-only routes | ✅ |
| **Magic-link sign-in** | `app/api/auth/magic/route.test.ts`, `app/login/__tests__/login-form.test.tsx`, `e2e/auth-recovery.spec.ts` | Request (no enumeration, rate-limit), invalid token → /login, `/login` toggle gating; full click-through e2e not yet | ⚠️ |
| **Invite (generate + accept)** | `lib/__tests__/queries_people.test.ts`, `app/api/people/[id]/invite/route.test.ts`, `e2e/invite.spec.ts` | Token create/read/delete; copy vs send-by-email, no-email/no-username/mail-disabled→400, admin-only; e2e generate + accept (set password) + login + single-use | ✅ |
| **Mail transport (Resend)** | `lib/mailer.test.ts` | Resend API branch + bearer auth, webhook fallback, no-transport log, never-throws, `isMailEnabled()` | ✅ |
| **Permissions** | `lib/permissions.test.ts` | Role / permission checks | ✅ |

---

## Beyond CRUD

| Feature | Test file(s) | What's covered | Status |
|---|---|---|---|
| **Settlement math — formulas** | `lib/__tests__/formulas.test.ts` | calcTripAmount (discount tiers, boundaries), calcPricePerLiter, calcPaymentYear | ✅ |
| **Settlement math — N/S1/S2/cross-car/own-car** | `lib/__tests__/settlement.test.ts` | N_new, S1, S2, s1_cross, net, transfers (step 1+2), car_settlements, fuel credit | ✅ |
| **Settlement lines (UI structure)** | `lib/__tests__/settlement_lines.test.ts` | Non-owner no payment, partial, net>0, two-car eras, settled-outside notes, owner section | ✅ |
| **Settlement message (text output)** | `lib/__tests__/settlement_message.test.ts` | No payment / partial / overpaid / negative alreadyPaid / net>0 | ✅ |
| **Break-even / admin PnL** | `lib/__tests__/break_even.test.ts` | beMetrics: net, pctCovered, status (ahead/behind) | ✅ |
| **Admin — car P&L queries** | `lib/__tests__/queries_admin.test.ts` | getCarPnL, getMonthlyCarKm, getPersonContributions, getHistoricalCarKm, getPriceHistory, getZeroKmTrips, getKmGaps (≤1km tolerance), getRollingFuelPerKm, getHistoricalOwnerSplit, getHistoricalExpenses | ✅ |
| **Admin — duplicate-trip detection (#276)** | `lib/__tests__/queries_admin_duplicates.test.ts` | Potential duplicate trips for the owner inbox | ✅ |
| **Admin — summary route** | `app/api/admin/summary/route.test.ts` | `/api/admin/summary` HTTP layer | ✅ |
| **Admin — skeleton loading states** | `e2e/admin-skeleton.spec.ts` | Inbox skeleton, gaps skeleton, no spinner | ✅ |
| **Admin — calendar renew + delta sync** | `lib/__tests__/calendar_renew.test.ts` | Skip-disabled, not-due+delta, 410 recovery, renew<5d, initial-setup, non-410 throws | ✅ |
| **Admin — reservation ↔ Google Calendar sync** | `lib/__tests__/reservation_sync.test.ts` | syncCreate/Update/Delete → Google Calendar API | ✅ |
| **Admin — calendar delta processing** | `lib/__tests__/process_calendar_delta.test.ts` | Skip unknown, skip echo (etag+nonce), overwrite time edit, confirm/reject on RSVP, cancelled=rejected | ✅ |
| **Admin — calendar backfill** | — | `POST /api/admin/calendar-backfill` untested | ❌ |
| **Admin settings** | `lib/__tests__/queries_settings.test.ts` | get (missing/existing), set (create/upsert/multi) | ✅ |
| **Offline — outbox (IndexedDB)** | `lib/offline/outbox.test.ts` | enqueue, list, peek, remove, count, clearAll, FIFO order | ✅ |
| **Offline — drain engine** | `lib/offline/sync-engine.test.ts` | Drain on 201, stop on 5xx, drop 409+continue, network abort | ✅ |
| **Offline — optimistic UI** | `lib/offline/optimistic.test.ts` | applyCreate, replaceCreate, rollbackCreate, applyUpdate, applyDelete | ✅ |
| **Offline — online state** | `lib/offline/online-state.test.ts` | computeStaleness: fresh/stale/unknown/boundary | ✅ |
| **Offline — prewarm** | `lib/offline/prewarm.test.ts` | prewarmCriticalEndpoints (parallel, failure tolerance), prewarmPages | ✅ |
| **Offline / pending badges** | `e2e/smoke.spec.ts`, `components/__tests__/offline-badge.test.tsx`, `components/__tests__/pending-badge.test.tsx` | Offline event → badge appears; pending-count badge rendering | ✅ |
| **Components — bottom tab bar** | `components/__tests__/bottom-tab-bar.test.tsx` | Hidden on /login + /invite; nav rendering | ✅ |
| **Components — cost-coverage screen** | `components/__tests__/cost-coverage-screen.test.tsx` | Coverage screen rendering / metrics | ✅ |
| **Components — grouped list** | `components/__tests__/grouped-list.test.tsx` | Grouping / lazy rendering | ✅ |
| **Theme context** | `lib/__tests__/theme_context.test.tsx` | paper/mono theme provider + persistence | ✅ |
| **Form validation — decimal input** | `lib/__tests__/form-decimal.test.ts` | period/comma/integer/empty/non-numeric/passthrough/positive | ✅ |
| **Form validation — payment schema** | `lib/__tests__/schemas_payment.test.ts` | Positive/negative amount, zero/missing rejected | ✅ |
| **API helpers** | `lib/__tests__/api_helpers.test.ts`, `lib/__tests__/api.test.ts` | HttpError, notFound/badRequest/forbidden, readBody, readId, canEdit | ✅ |
| **Dashboard queries** | `lib/__tests__/queries.test.ts` | getDashboard (zero/negative balance, year filter, payments, expense_count, settled_outside), getLastCarState | ✅ |
| **Migrations — 0003 / 0004+0005 / 0011–0014 / 0018** | `migration_0003.test.ts`, `migration_0004.test.ts`, `migration_0011_to_0014.test.ts`, `migration_0018.test.ts` | Per-migration columns, constraints, backfills, defaults | ✅ |
| **Migrations — others** | — | Not individually tested (exercised implicitly by `runMigrations` in every unit test) | ⚠️ |
| **Full schema** | `lib/__tests__/db.test.ts` | All tables, FK enforcement, migration log, idempotency | ✅ |
| **Cache invalidation** | `e2e/cache-invalidation.spec.ts` | Reservation + payment appear without reload | ✅ |
| **Direct URL edit close behavior** | `e2e/direct-url-edit.spec.ts` | Close stays on /trips, save closes + stays on /trips | ✅ |
| **Accessibility** | `e2e/a11y-audit.spec.ts` | Key routes audited (login, trips, expenses, fuel, vehicles, calendar, payments, people, owner, admin/*) | ✅ |
| **i18n** | `lib/__tests__/i18n.test.ts` | Known key, placeholder substitution, numeric params, missing-param fallback | ✅ |
| **Person name utilities** | `lib/__tests__/person_utils.test.ts` | shortNameOf, fullNameOf | ✅ |
| **Paper theme / formatting** | `lib/__tests__/paper_theme.test.ts` | CSS vars, fmtMoney, fmtKm, fmtDate, fmtYearMonth, amtColor, signPrefix | ✅ |
| **UUID generation** | `lib/__tests__/uuid.test.ts`, `lib/offline/uuid.test.ts` | RFC4122 v4 shape, uniqueness, fallback | ✅ |
| **Google Calendar addDays** | `lib/__tests__/google_calendar.test.ts` | Day/month/year/leap-year boundaries | ✅ |
| **Health endpoint** | `app/api/health/route.test.ts` | GET `{ ok, version }`, HEAD 200 | ✅ |

---

## API Route HTTP-Layer Coverage

**15 of 44** `app/api/**/route.ts` have a co-located `route.test.ts`:

```
✅ tested
  health                       payments
  admin/summary                reservations/[id]/status
  people/[id]/profile          people/[id]/invite
  people/[id]/revoke-sessions
  auth/login                   auth/logout
  auth/logout-all              auth/cloak
  auth/uncloak                 auth/forgot
  auth/magic                   auth/reset/[token]
```

Untested at the HTTP layer (29 — most are covered indirectly by query-level unit tests and/or e2e): `trips`, `trips/[id]`, `fuel`, `fuel/[id]`, `expenses`, `expenses/[id]`, `payments/[id]`, `reservations`, `reservations/[id]`, `vehicles`, `vehicles/[id]`, `vehicles/[id]/last-state`, `people`, `people/[id]`, `settlement/[year]`, `invite/[token]`, `me`, `calendar-id`, `calendar-webhook`, `admin/settings`, `admin/calendar-backfill`, `admin/calendar-renew`, `admin/calendar-test`, `dashboard`, `dashboard/earliest-year`, `docs`, `static/[...path]`, `uploads`, `auth/magic/[token]`.

---

## Gap Summary

| # | Gap | Severity | Status / Related issue |
|---|-----|----------|------------------------|
| 1 | Auth password change / reset | — | ✅ Closed — forgot+reset route tests + `e2e/auth-recovery` |
| 2 | Auth cloak / uncloak | — | ✅ Closed — cloak+uncloak route tests |
| 3 | Auth logout | — | ✅ Closed — logout + logout-all route tests |
| 4 | People delete / deactivate | — | ✅ Closed — `e2e/members` |
| 5 | Cars / vehicles e2e CRUD | — | ✅ Closed — `e2e/vehicles` |
| 6 | Payments e2e update / delete | — | ✅ Closed — `e2e/payments` |
| 7 | Settlement functional e2e (lock / unlock) | — | ✅ Closed — `e2e/settlement` (message/finalize still unit-only) |
| 8 | Invite accept e2e | — | ✅ Closed — `e2e/invite` |
| 9 | API route HTTP-layer coverage | Medium | Improved: 15/44 tested; ~29 routes still rely on query-unit / e2e coverage |
| 10 | Admin calendar backfill — no test | Low | Open — `POST /api/admin/calendar-backfill` |
| 11 | Magic-link full click-through e2e | Low | Open — request/invalid-token covered; no end-to-end "click link → logged in" UI test |
| 12 | Branded HTML email bodies | Low | Open — #295 (feature not built; mail is plain text) |
| 13 | PWA pull-to-refresh | Low | Open — #302 (feature not built) |
