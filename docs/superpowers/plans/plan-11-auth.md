# CarSharing — Plan 11: Auth Gate (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisites:** plans 00–10 and 03b completed.

**Goal:** Add a shared-password login gate so only family members can access the app — every user shares one username + password stored in env vars.

**Architecture:** `iron-session` seals a signed `HttpOnly` cookie (`autodelen_session`). Next.js `middleware.ts` checks the cookie on every request and redirects unauthenticated traffic to `/login`. The credential comparison is extracted into `lib/auth.ts` (testable without HTTP). Phase A touches no DB tables — env vars only. The `SessionData` type and `sessionOptions` are defined once in `lib/session.ts`; Phase B widens the type without breaking Phase A consumers.

**Tech Stack:** iron-session, bcryptjs, Next.js 15 middleware, Vitest.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `lib/session.ts` | Create | `SessionData` type + `sessionOptions` — single source of truth for session shape |
| `lib/auth.ts` | Create | `verifyCredentials()` — timing-safe credential comparison, fully testable |
| `lib/__tests__/auth.test.ts` | Create | Vitest unit tests for `verifyCredentials` |
| `middleware.ts` | Create | Redirects unauthenticated requests to `/login` |
| `app/login/page.tsx` | Create | Login form — client component, posts to `/api/auth/login` |
| `app/api/auth/login/route.ts` | Create | Validates credentials, sets session cookie |
| `app/api/auth/logout/route.ts` | Create | Destroys session cookie |
| `scripts/hash-password.ts` | Create | CLI utility to bcrypt-hash a password for `AUTH_PASSWORD_HASH` |
| `lib/i18n/messages/nl.ts` | Modify | Add `error.invalid_credentials` and `nav.logout` keys |
| `components/nav-drawer.tsx` | Modify | Add Uitloggen button at bottom of drawer |
| `.env.local.example` | Create | Documents required env vars |

---

### Task 1: Install packages, add i18n keys, document env vars

**Files:**
- Modify: `lib/i18n/messages/nl.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Install packages**

```bash
npm install iron-session bcryptjs
npm install -D @types/bcryptjs
```

Expected: no errors, `iron-session` and `bcryptjs` appear in `package.json` dependencies.

- [ ] **Step 2: Add i18n keys to lib/i18n/messages/nl.ts**

Open `lib/i18n/messages/nl.ts` and add four keys in the appropriate sections:

```ts
  // Actions (buttons, generic FAB) — add action.login
  "action.add": "Toevoegen",
  "action.login": "Inloggen",       // ← add this
  "action.save": "Opslaan",
  "action.cancel": "Annuleer",
  "action.delete": "Verwijderen",

  // Form labels — add form.password
  "form.name": "Naam *",
  "form.password": "Wachtwoord",    // ← add this
  // ...

  // Errors shown inline — add error.invalid_credentials
  "error.gps_unavailable": "GPS niet beschikbaar",
  "error.invalid_credentials": "Ongeldige gebruikersnaam of wachtwoord",  // ← add this

  // Primary navigation — add nav.logout
  "nav.logout": "Uitloggen",        // ← add this
```

- [ ] **Step 3: Create .env.local.example**

```bash
# Copy to .env.local and fill in values before running the app.
# SESSION_PASSWORD must be at least 32 random characters.
# AUTH_PASSWORD_HASH is produced by: npx tsx scripts/hash-password.ts <your-password>

SESSION_PASSWORD=replace-with-32-plus-random-characters-here
AUTH_USERNAME=autodelen
AUTH_PASSWORD_HASH=replace-with-bcrypt-hash-from-hash-password-script
```

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/messages/nl.ts .env.local.example package.json package-lock.json
git commit -m "feat(auth): install iron-session + bcryptjs, add i18n keys, document env vars"
```

---

### Task 2: Session module and credential helper

**Files:**
- Create: `lib/session.ts`
- Create: `lib/auth.ts`
- Create: `lib/__tests__/auth.test.ts`

- [ ] **Step 1: Create lib/session.ts**

```ts
import type { IronSessionOptions } from "iron-session";

export interface SessionData {
  // Phase B widens this with personId?: number and isAdmin?: boolean
  // without breaking any Phase A consumer — only authenticated is checked here.
  authenticated: boolean;
}

export const sessionOptions: IronSessionOptions = {
  cookieName: "autodelen_session",
  password: process.env.SESSION_PASSWORD as string,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
```

- [ ] **Step 2: Create lib/auth.ts**

```ts
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

interface Credentials {
  username: string;
  password: string;
}

interface StoredCredentials {
  username: string;
  passwordHash: string;
}

// Both comparisons always run regardless of whether the username matched.
// Bailing out early on a username mismatch would leak which field was wrong
// via response timing.
export async function verifyCredentials(
  input: Credentials,
  stored: StoredCredentials
): Promise<boolean> {
  const maxLen = Math.max(
    Buffer.byteLength(input.username),
    Buffer.byteLength(stored.username)
  );
  const a = Buffer.alloc(maxLen);
  const b = Buffer.alloc(maxLen);
  Buffer.from(input.username).copy(a);
  Buffer.from(stored.username).copy(b);
  const usernameMatch = timingSafeEqual(a, b);

  const passwordMatch = await bcrypt.compare(input.password, stored.passwordHash);
  return usernameMatch && passwordMatch;
}
```

- [ ] **Step 3: Write failing tests in lib/__tests__/auth.test.ts**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials } from "../auth";

let HASH: string;

beforeAll(async () => {
  // Cost 4 keeps tests fast; production uses cost 12.
  HASH = await bcrypt.hash("correct-horse", 4);
});

describe("verifyCredentials", () => {
  it("returns true for matching username and password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "correct-horse" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(true);
  });

  it("returns false for wrong username", async () => {
    expect(
      await verifyCredentials(
        { username: "bob", password: "correct-horse" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false for wrong password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "wrong" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false for empty password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false when both username and password are wrong", async () => {
    expect(
      await verifyCredentials(
        { username: "hacker", password: "guess" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL (auth.ts not yet created)**

```bash
npm test lib/__tests__/auth.test.ts
```

Expected: `FAIL — Cannot find module '../auth'`

- [ ] **Step 5: Run tests again — expect PASS (auth.ts now exists)**

```bash
npm test lib/__tests__/auth.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/session.ts lib/auth.ts lib/__tests__/auth.test.ts
git commit -m "feat(auth): session options module and timing-safe credential helper with tests"
```

---

### Task 3: Hash-password script

**Files:**
- Create: `scripts/hash-password.ts`

- [ ] **Step 1: Create scripts/hash-password.ts**

```ts
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
```

- [ ] **Step 2: Verify it works**

```bash
npx tsx scripts/hash-password.ts mysecret
```

Expected: prints a string like `$2b$12$...` (60 characters).

- [ ] **Step 3: Generate credentials for .env.local**

```bash
npx tsx scripts/hash-password.ts <your-chosen-shared-password>
```

Paste the output into `.env.local` as `AUTH_PASSWORD_HASH`. Also set `SESSION_PASSWORD` to 32+ random chars and `AUTH_USERNAME` to your chosen username. The file should look like:

```
SESSION_PASSWORD=AbCdEfGhIjKlMnOpQrStUvWxYz012345
AUTH_USERNAME=autodelen
AUTH_PASSWORD_HASH=$2b$12$...
```

- [ ] **Step 4: Commit**

```bash
git add scripts/hash-password.ts
git commit -m "feat(auth): hash-password script for generating AUTH_PASSWORD_HASH"
```

---

### Task 4: Login API route

**Files:**
- Create: `app/api/auth/login/route.ts`

- [ ] **Step 1: Create app/api/auth/login/route.ts**

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  const { AUTH_USERNAME, AUTH_PASSWORD_HASH } = process.env;
  if (!AUTH_USERNAME || !AUTH_PASSWORD_HASH || !process.env.SESSION_PASSWORD) {
    console.error("AUTH_USERNAME, AUTH_PASSWORD_HASH, or SESSION_PASSWORD env vars are not set");
    return NextResponse.json({ error: "server_misconfiguration" }, { status: 500 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await verifyCredentials(
    { username, password },
    { username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH }
  );

  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  await session.save();
  return res;
}
```

- [ ] **Step 2: Smoke-test with curl (dev server must be running)**

```bash
npm run dev &
sleep 3

# Wrong credentials → 401
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"wrong","password":"wrong"}' | cat

# Expected: {"error":"invalid_credentials"}

# Correct credentials (use your AUTH_USERNAME and actual password, not hash)
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"autodelen","password":"<your-plain-password>"}' | cat

# Expected: {"ok":true}   and /tmp/cookies.txt contains "autodelen_session"
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat(auth): login API route with timing-safe credential check"
```

---

### Task 5: Logout API route

**Files:**
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create app/api/auth/logout/route.ts**

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  return res;
}
```

- [ ] **Step 2: Smoke-test with curl**

```bash
# Log in first to get a session cookie
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"autodelen","password":"<your-plain-password>"}'

# Logout — should clear the cookie
curl -s -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/logout | cat

# Expected: {"ok":true}  and the autodelen_session cookie is gone or has maxAge=0
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/logout/route.ts
git commit -m "feat(auth): logout API route"
```

---

### Task 6: Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts at the project root**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Paths that are always accessible — no auth check.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets and Next.js internals are excluded via the matcher below.
  // Explicitly public API/page paths bypass the session check.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // If already authenticated and hitting /login, redirect home.
    if (pathname === "/login") {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (session.authenticated) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// Run on all paths except Next.js build artefacts and static files.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon.*\\.png|manifest\\.webmanifest|uploads/).*)",
  ],
};
```

- [ ] **Step 2: Verify middleware redirects unauthenticated requests**

With the dev server running and NO session cookie:

```bash
# Accessing a protected page should redirect to /login (302)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 307 (Next.js temporary redirect to /login)

# Accessing /login without a session should NOT redirect (200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
# Expected: 200

# Accessing a protected API route should also redirect
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/trips
# Expected: 307
```

- [ ] **Step 3: Verify authenticated requests pass through**

```bash
# Log in to get a cookie
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"autodelen","password":"<your-plain-password>"}'

# Access a protected route with the cookie — should be 200
curl -s -o /dev/null -w "%{http_code}" -b /tmp/cookies.txt http://localhost:3000/api/trips
# Expected: 200

# Access /login while authenticated — should redirect to /
curl -s -o /dev/null -w "%{http_code}" -b /tmp/cookies.txt http://localhost:3000/login
# Expected: 307 (redirect to /)
```

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware redirects unauthenticated requests to /login"
```

---

### Task 7: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create app/login/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setError(t("error.invalid_credentials"));
      }
    } catch {
      setError(t("error.invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-xl border-2 border-blue-600 flex items-center justify-center">
            <Car className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold">{t("brand.app")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("form.password")}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? t("state.loading") : t("action.login")}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify full login flow in browser**

```bash
npm run dev
```

1. Open http://localhost:3000 in an incognito window (no cookie). Should redirect to `/login`.
2. Enter wrong credentials → error message appears inline, no page reload.
3. Enter correct credentials → redirected to `/` (dashboard).
4. Refresh → stays on dashboard (cookie persists).
5. Open `/login` while logged in → redirected to `/`.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(auth): login page with inline error and redirect on success"
```

---

### Task 8: NavDrawer logout button

**Files:**
- Modify: `components/nav-drawer.tsx`

- [ ] **Step 1: Update components/nav-drawer.tsx**

Add `useRouter` import and a logout handler, then append an Uitloggen button below the `<nav>` block. The full updated file:

```tsx
"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, Car, LayoutDashboard, CalendarDays, Users, CreditCard, Wrench, LogOut } from "lucide-react";
import { t } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
  { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays },
  { href: "/people", label: t("nav.people"), icon: Users },
  { href: "/cars", label: t("nav.cars"), icon: Car },
  { href: "/expenses", label: t("nav.expenses"), icon: Wrench },
  { href: "/payments", label: t("nav.payments"), icon: CreditCard },
];

export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="p-2 rounded-md hover:bg-gray-100" aria-label={t("nav.menu")}>
          <Menu className="w-5 h-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
        <Dialog.Content className="fixed left-0 top-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b">
            <div className="w-10 h-10 rounded border-2 border-blue-600 flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-lg font-semibold">{t("brand.app")}</span>
            <Dialog.Close asChild>
              <button className="ml-auto p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                  pathname === href ? "text-blue-600 bg-blue-50 border-l-4 border-blue-600" : "text-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t py-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors w-full text-left"
            >
              <LogOut className="w-5 h-5" />
              {t("nav.logout")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verify logout flow in browser**

1. Log in and navigate to any page.
2. Open the hamburger drawer.
3. "Uitloggen" appears at the bottom, separated by a border.
4. Tap it → redirected to `/login`.
5. Try navigating to `/` directly → redirected back to `/login`.

- [ ] **Step 3: Commit**

```bash
git add components/nav-drawer.tsx
git commit -m "feat(auth): logout button in nav drawer"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `SESSION_PASSWORD`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` env vars | Task 1, 3 |
| `lib/session.ts` — `SessionData` + `sessionOptions` | Task 2 |
| `lib/auth.ts` — `verifyCredentials` with `timingSafeEqual` | Task 2 |
| Tests for `verifyCredentials` (5 cases) | Task 2 |
| `scripts/hash-password.ts` | Task 3 |
| `app/api/auth/login/route.ts` — 200 on match, 401 on mismatch | Task 4 |
| `app/api/auth/logout/route.ts` — destroys session | Task 5 |
| `middleware.ts` — redirects unauthenticated, allows public paths, redirects authenticated /login → / | Task 6 |
| `app/login/page.tsx` — username+password form, inline error | Task 7 |
| `form.password` i18n key | Task 7 |
| `error.invalid_credentials`, `nav.logout`, `form.password`, `action.login` i18n keys | Task 1 |
| NavDrawer logout button | Task 8 |
| Phase A does NOT touch `people` table | Confirmed — no DB changes in any task |
| `SessionData` widens additively for Phase B | Task 2 — comment documents Phase B contract |
