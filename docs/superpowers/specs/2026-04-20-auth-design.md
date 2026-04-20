# Auth & Role-Based Dashboard — Design Spec

**Date:** 2026-04-20
**Project:** CarSharing (Autodelen) PWA
**Scope:** Plan-11 delivers Phase A (shared-password gate). Phase B (per-user auth + role-based dashboard) is sketched here to keep Phase A's choices forward-compatible; Phase B gets its own plan.

---

## Overview

The app currently has no login gate. Two phases are planned:

- **Phase A (plan-11):** All family members share one username + password stored in env vars. Every form still has a Person dropdown. The sole purpose is to prevent public access.
- **Phase B (future plan):** Each person has their own account (credentials in the `people` table). Name is auto-filled and locked for non-admins. Non-admins see only their own dashboard row; admins see everyone and may override the Person field on any form.

---

## Tech choices

| Concern | Choice | Reason |
|---|---|---|
| Cookie sealing | `iron-session` | Tiny, audited, zero-config; avoids hand-rolled HMAC boilerplate |
| Password hashing | `bcryptjs` | Pure JS (no native bindings), works in Docker without node-gyp |
| External auth framework | None | NextAuth is overkill for env-var + bcrypt; adds 100 kB and complex config |

---

## Phase A — Shared password gate

### Environment variables

```
SESSION_PASSWORD=<32+ random chars>   # iron-session cookie encryption key
AUTH_USERNAME=autodelen                # shared login username
AUTH_PASSWORD_HASH=<bcrypt hash>       # bcrypt hash of shared password (cost 12)
```

`AUTH_PASSWORD_HASH` is generated once with `scripts/hash-password.ts` (see below) and pasted into `.env.local` and the Docker stack's `environment:` block.

### New files

**`lib/session.ts`**

The single source of truth for session shape and iron-session config. Exports:

```ts
export interface SessionData {
  authenticated: boolean;
  // Phase B widens this type — no breaking changes to Phase A consumers
}

export const sessionOptions: IronSessionOptions = {
  cookieName: "autodelen_session",
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(req: Request): Promise<IronSession<SessionData>>
```

**`app/login/page.tsx`**

Client component. Username + password form. POSTs to `/api/auth/login`. On `200` → `router.replace("/")`. On `401` → inline `t("error.invalid_credentials")` message. No redirect on success via server-side redirect — client-side replace avoids a full page reload on the login form.

**`app/api/auth/login/route.ts`**

```
POST /api/auth/login
Body: { username: string; password: string }
```

Steps:
1. Compare `username` to `AUTH_USERNAME` using `crypto.timingSafeEqual` (pad/truncate both to the same length as `Buffer` before comparing — prevents timing attacks even on the username check).
2. `bcryptjs.compare(password, AUTH_PASSWORD_HASH)`.
3. Both pass → `session.authenticated = true; session.save()` → `200 { ok: true }`.
4. Any mismatch → `401 { error: "invalid_credentials" }` — identical response regardless of which field failed (prevents enumeration).

**`app/api/auth/logout/route.ts`**

```
POST /api/auth/logout
```

Destroys the session cookie, returns `200 { ok: true }`. The client redirects to `/login`.

**`middleware.ts`** (new file at project root)

Runs on every request. Allowlisted paths that bypass auth:
- `/login`
- `/api/auth/login`
- `/_next/*`
- `/uploads/*`
- `/favicon.ico`, `*.png`, `*.webp` (PWA icons)

All other paths: read session via `getIronSession`. If `!session.authenticated` → `NextResponse.redirect(new URL("/login", req.url))`.

Middleware never touches the DB — only reads the sealed cookie.

**`scripts/hash-password.ts`**

```ts
import bcrypt from "bcryptjs";
const password = process.argv[2];
if (!password) { console.error("Usage: npx tsx scripts/hash-password.ts <password>"); process.exit(1); }
const hash = await bcrypt.hash(password, 12);
console.log(hash);
```

Run once: `npx tsx scripts/hash-password.ts mypassword` → paste output into `AUTH_PASSWORD_HASH`.

### Nav changes

`NavDrawer` (plan-04) gets a new "Uitloggen" item at the bottom (uses `t("nav.logout")` — new i18n key). On click it POSTs to `/api/auth/logout` then redirects to `/login`.

### New i18n keys

Two keys added to `lib/i18n/messages/nl.ts`:
```ts
"error.invalid_credentials": "Ongeldige gebruikersnaam of wachtwoord",
"nav.logout": "Uitloggen",
```

---

## Phase B sketch — Per-user auth (future plan)

> This section is a design contract, not an implementation spec. It ensures Phase A makes no choices that need to be undone in Phase B.

### DB migration

Three nullable columns added to `people` via idempotent `ALTER TABLE` in `lib/schema.sql.ts`:

```sql
ALTER TABLE people ADD COLUMN username TEXT UNIQUE;
ALTER TABLE people ADD COLUMN password_hash TEXT;
ALTER TABLE people ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
```

`applySchema` runs on startup; SQLite's `ALTER TABLE` is a no-op if the column already exists (using a try/catch per-column approach). No separate migration runner needed.

### Session payload widening

`SessionData` in `lib/session.ts` gains two optional fields:

```ts
export interface SessionData {
  authenticated: boolean;
  personId?: number;    // set after Phase B login; absent in Phase A sessions
  isAdmin?: boolean;    // set after Phase B login; absent in Phase A sessions
}
```

Phase A middleware checks only `authenticated`, so existing sessions continue working during Phase B rollout.

### Login route change

`app/api/auth/login/route.ts` replaces the env-var comparison with a DB lookup: `SELECT * FROM people WHERE username = ?`. If found and `bcryptjs.compare(password, row.password_hash)` passes → sets `session = { authenticated: true, personId: row.id, isAdmin: !!row.is_admin }`. Phase B is a clean cutover — all members get accounts via `scripts/setup-admin.ts` before Phase B deploys; the env-var credentials are removed from the environment.

### Dashboard API scope

`GET /api/dashboard` reads `session.isAdmin` and `session.personId`:

```ts
const rows = getDashboard(db, year);
if (!session.isAdmin && session.personId) {
  return rows.filter((r) => r.person_id === session.personId);
}
return rows; // admin sees all
```

`getDashboard` query is unchanged.

### Form PersonSelect

A `<PersonSelectOrHidden>` component replaces the raw `<PersonSelect>` on trip/fuel/expense forms:

- `isAdmin === true` → renders `<PersonSelect>` (full dropdown, admin may override).
- `isAdmin === false` → renders `<input type="hidden" value={session.personId} />` (locked to the logged-in person; field label still shows the person name for clarity).

### Bootstrap

`scripts/setup-admin.ts` — interactive CLI run once after Phase B deploys:

```
npx tsx scripts/setup-admin.ts
```

Lists `people` rows, prompts operator to pick one, enter a username and password. Writes `username` + `bcrypt.hash(password, 12)` + `is_admin = 1` to that row. Subsequent admin accounts can be created through the admin UI in the People page.

---

## What Phase A does NOT do

- Does not touch the `people` table.
- Does not add `personId` or `isAdmin` to the session.
- Does not restrict any API route beyond checking `authenticated`.
- Does not change any form's Person dropdown.

All of these are Phase B concerns.

---

## Testing

**Phase A:**
- Login with correct credentials → session cookie set, redirected to `/`.
- Login with wrong username → `401`, same error message as wrong password.
- Login with wrong password → `401`.
- Access `/trips` without session → redirected to `/login`.
- Access `/api/trips` without session → redirected to `/login` (middleware covers API routes too).
- Logout → cookie cleared, next request redirects to `/login`.

**Phase B (future):**
- Non-admin login → dashboard returns only own row.
- Admin login → dashboard returns all rows.
- Non-admin form submission → `person_id` locked to session person, cannot be overridden via payload manipulation (API reads from session, not body).
- Phase A sessions still in cookies when Phase B deploys → `session.personId` is `undefined` → user is redirected to `/login` to re-authenticate with their personal credentials. The Phase B login route checks that `row.username` is non-null before accepting the login, so accounts without a username configured are rejected with `401`.
