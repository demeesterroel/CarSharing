# Security Audit & Hardening — CarSharing

_Date: 2026-05-28 · Branch: `claude/security-scan-hardening-JB8Tt`_

This document records a security review of the CarSharing application (self-hosted
Next.js 16 App Router PWA, SQLite via `better-sqlite3`, `iron-session` auth) and the
hardening changes applied on this branch.

**Threat model.** A small, invite-only car-sharing cooperative. All authenticated
users are semi-trusted members; there is no public self-registration. The app is
self-hosted as a single container behind a TLS-terminating reverse proxy (Traefik).
The primary risks are therefore privilege escalation _between_ authenticated roles
(member → owner/admin), brute-force of the single login, and standard web hardening.

---

## Summary of findings

| #   | Severity    | Finding                                                                                                 | Status                 |
| --- | ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **High**    | Broken access control on `/api/payments` — any member could create/edit/delete/read settlement payments | ✅ Fixed               |
| 2   | **Medium**  | `/api/reservations/[id]/status` had no authorization — any member could confirm/reject any reservation  | ✅ Fixed               |
| 3   | **Medium**  | Login endpoint not rate-limited (brute force)                                                           | ✅ Fixed               |
| 4   | **Medium**  | No HTTP security headers (CSP, clickjacking, sniffing, HSTS, referrer, permissions)                     | ✅ Fixed               |
| 5   | **Low/Med** | Upload trusts client `Content-Type`; no CSRF; served without `nosniff`                                  | ✅ Fixed               |
| 6   | **Low**     | `/api/people` exposed email & bank account to all members                                               | ✅ Fixed               |
| 7   | **Info**    | Generic CRUD factories allowed routes with _no_ authorization (root cause of #1)                        | ✅ Hardened            |
| 8   | **Info**    | `npm audit`: 11 advisories, all in build-time PWA tooling                                               | Documented (no action) |
| 9   | **Info**    | In-memory rate limit keyed on spoofable `X-Forwarded-For`                                               | Documented             |
| —   | —           | Server-side session revocation ("log out everywhere")                                                   | Tracked in #266        |
| —   | —           | Self-service password reset / magic link                                                                | Tracked in #267        |

---

## Findings in detail

### 1. Broken access control on `/api/payments` (High) — fixed

`app/api/payments/route.ts` and `app/api/payments/[id]/route.ts` used the generic
CRUD factories with no authorization callback. The `/payments` **page** is restricted
to admins by the proxy middleware, but the middleware does not guard the
`/api/payments*` routes, so **any authenticated member could call the API directly**
to create, edit, delete, or list settlement payments — directly affecting the annual
settlement math.

**Fix.** All four payment endpoints now require an admin session (`requireAdmin`),
matching the UI restriction. GET is included because the list reveals every member's
individual payment history and is only consumed by the admin page.

### 2. Missing authorization on reservation status (Medium) — fixed

`PATCH /api/reservations/[id]/status` performed no authorization check, so any member
could confirm or reject **any** reservation, bypassing the car-owner approval flow.

**Fix.** Added `requireAdminOrCarOwner()` (`lib/api.ts`): only the car's owner or an
admin may change a reservation's status. (Decision: members cannot self-confirm their
own reservations — confirmation is the owner's prerogative.)

### 3. Login brute-force (Medium) — fixed

`POST /api/auth/login` does not use the shared `json()` wrapper, and the wrapper is
where the per-IP login rate limit lived — so login had **no** rate limiting.

**Fix.** The login route now applies `checkRateLimit` directly: 5 attempts per IP per
15 minutes, returning `429` with `Retry-After` before credentials are checked.

### 4. HTTP security headers (Medium) — fixed

No security headers were set. Added in `next.config.ts` `headers()`:

- **Content-Security-Policy** — `default-src 'self'`; `object-src 'none'`;
  `frame-ancestors 'none'`; `base-uri`/`form-action 'self'`; images allow `data:`/`blob:`/`https:`
  (CARTO map tiles); `connect-src` allows Nominatim reverse-geocoding; `'unsafe-inline'`
  is required for Next.js bootstrap scripts and the app's inline styles, and
  `'unsafe-eval'` is added **only** in development (HMR). The strict CSP is applied to
  every route **except** `/docs` (the dev-only Scalar API reference, which needs
  inline/CDN scripts).
- **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**,
  **Referrer-Policy: strict-origin-when-cross-origin**,
  **Permissions-Policy** (camera/mic/payment denied, geolocation self),
  **X-DNS-Prefetch-Control: off**, and **HSTS** (2 years, prod only).

> CSP note: hardening `script-src` further (dropping `'unsafe-inline'` via per-request
> nonces) is possible but requires wiring a nonce through the proxy middleware and the
> document; deferred as it risks breaking the PWA/hydration with limited marginal gain
> for this threat model.

### 5. Upload hardening (Low/Med) — fixed

`POST /api/uploads` accepted files based solely on the client-supplied `File.type`
(spoofable), ran outside the CSRF-protected wrapper, and served results without
anti-sniffing headers.

**Fix.**

- CSRF token now validated on upload (it is a mutating, authenticated endpoint).
- File **content** is verified against its declared type via magic-byte sniffing
  (JPEG/PNG/WebP signatures) — a payload disguised as an image is rejected.
- The static serving route (`/api/static/[...path]`) now sends
  `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`.
  (The existing path-traversal guard via `path.relative` was reviewed and is sound.)

### 6. Member data exposure via `/api/people` (Low) — fixed

`GET /api/people` returned full person rows — including `email` and `bank_account` —
to any authenticated member (the password hash was already stripped). The list is used
widely by forms, but contact/banking details are not needed there.

**Fix.** `email` and `bank_account` are stripped from the list response for non-admin
callers. Admins still receive the full rows. Per-record reads and own-profile edits are
unaffected.

### 7. CRUD factories allowed unauthorized routes (Info) — hardened

The root cause of #1: `createHandler`/`updateHandler`/`deleteHandler` had no way to
express authorization, so a route could be written with none. They now **require** an
`authorize` callback (and the read factories accept an optional one), making it
impossible to add a mutating CRUD route without declaring who may call it.

### 8. Dependency advisories (Info) — documented, no action

`npm audit` reports 11 advisories (7 moderate, 4 high), **all** transitive
build-time-only dependencies of `@ducanh2912/next-pwa`
(`workbox-build` → `@rollup/plugin-terser` → `serialize-javascript`). They run during
the build (service-worker generation), not in the deployed runtime, so there is no
runtime exposure. The only fix is a breaking `next-pwa` downgrade; per maintainer
decision this is **not** applied. Re-evaluate when `next-pwa`/`workbox` ship a patched
release.

### 9. Rate limit keyed on `X-Forwarded-For` (Info) — documented

`lib/rate-limit.ts` is in-memory (per process) and keyed on the first
`X-Forwarded-For` value, which a client can spoof. Acceptable for a single-instance
deployment behind a trusted reverse proxy that overwrites the header. If ever scaled
horizontally or exposed without a normalizing proxy, move to a shared store and use the
proxy's trusted client-IP.

---

## Reviewed and found sound

- **SQL injection** — all queries use parameterized `?` placeholders (`better-sqlite3`);
  no string interpolation of user input into SQL.
- **Password storage** — bcrypt (cost 12); login uses constant-time username comparison
  to avoid timing side channels.
- **Session cookie** — `iron-session`, encrypted, `httpOnly`, `secure` in production,
  `sameSite=strict`, 7-day expiry.
- **CSRF** — double-submit cookie validated on all mutating methods via the `json()`
  wrapper (and now explicitly on the login-adjacent and upload routes).
- **Invite tokens** — 192-bit random, single-use, 7-day expiry.
- **Calendar webhook / cron** — webhook validates the Google channel id; the
  calendar-renew cron endpoint requires a `CRON_SECRET` bearer token.
- **Path traversal** — upload serving normalizes and confines paths to the uploads root.

## Follow-ups (separate issues)

- **#266** — "log out everywhere" / server-side session revocation (a leaked stateless
  cookie currently can't be invalidated before its 7-day expiry).
- **#267** — self-service password reset / magic-link sign-in (needs email transport).

## Verification

`npm run lint` (0 errors), `tsc --noEmit` (clean), `npm test` (480 passing, incl. new
tests for payments authz, reservation-status authz, and login rate limiting),
`npm run build` (succeeds), and a runtime check confirming the security headers are
emitted on app routes and the CSP is correctly omitted on `/docs`.
