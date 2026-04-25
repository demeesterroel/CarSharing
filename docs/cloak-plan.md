# Admin Cloak-as-User — Implementation Plan

## 1. Overview

An authenticated admin can tap a "Cloak" button on any member's `PersonCard` in the Members tab of `/admin`. This writes a `cloakedAs` object into the existing iron-session cookie, persisting across page refreshes. The `/api/me` route detects the cloaked state and returns the cloaked person's identity; all forms and mutations therefore submit the cloaked person's `person_id` automatically via the existing `useMe()` flow. A fixed amber banner appears at the top of every page while cloaked. The bottom-nav Admin tab is replaced by an "Exit" button that POSTs to `/api/auth/uncloak`, clears `cloakedAs` from the session, and redirects to `/admin`. Middleware blocks all `/admin/*` routes while `cloakedAs` is set.

---

## 2. Affected Files

| File | Change | Summary |
|---|---|---|
| `lib/session.ts` | Modify | Add `cloakedAs` field to `SessionData` |
| `app/api/auth/cloak/route.ts` | **New** | POST — set `session.cloakedAs`; admin-only |
| `app/api/auth/uncloak/route.ts` | **New** | POST — delete `session.cloakedAs` |
| `app/api/me/route.ts` | Modify | Return cloaked person's identity + `isCloaked` flag when active |
| `hooks/use-me.ts` | Modify | Add `isCloaked` and `cloakedAs` fields to `Me` type |
| `middleware.ts` | Modify | Block `/admin/*` while `session.cloakedAs` is set |
| `components/cloak-banner.tsx` | **New** | Client component: amber banner + exit button |
| `app/layout.tsx` | Modify | Render `<CloakBanner />` inside the page container |
| `components/bottom-tab-bar.tsx` | Modify | Replace Admin tab with Exit-cloak button when `isCloaked` |
| `lib/i18n/messages/nl.ts` | Modify | Add translation keys: `cloak.*` |
| `lib/i18n/messages/en.ts` | Modify | Add same keys in English |
| `app/admin/page.tsx` | Modify | Add "Cloak" button to each active `PersonCard` |

---

## 3. Implementation Steps

### Step 1 — `lib/session.ts`: Add `cloakedAs` to `SessionData`

**File:** `/home/roeland/Projects/CarSharing/lib/session.ts`

**Old (lines 3–8):**
```ts
export interface SessionData {
  authenticated: boolean;
  personId?: number;
  personName?: string;
  isAdmin?: boolean;
}
```

**New:**
```ts
export interface SessionData {
  authenticated: boolean;
  personId?: number;
  personName?: string;
  isAdmin?: boolean;
  /** Set while an admin is impersonating another person. */
  cloakedAs?: {
    personId: number;
    personName: string;
    isAdmin: boolean;
  };
}
```

**Why:** All downstream API routes and middleware read from the session via iron-session. Adding the field here keeps the type contract in one place and iron-session serialises it automatically into the encrypted cookie.

**Gotcha:** `cloakedAs` must be `undefined` (not `null`) when not cloaking, because iron-session omits `undefined` keys from the cookie payload, keeping cookies smaller.

---

### Step 2 — `app/api/auth/cloak/route.ts`: New endpoint to start cloaking

**File:** `/home/roeland/Projects/CarSharing/app/api/auth/cloak/route.ts` (new file)

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getPersonById } from "@/lib/queries/people";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { personId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const targetId = typeof body.personId === "number" ? body.personId : null;
  if (!targetId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const person = getPersonById(getDb(), targetId);
  if (!person || !person.active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  session.cloakedAs = {
    personId: person.id,
    personName: person.name,
    isAdmin: person.is_admin === 1,
  };
  await session.save();
  return res;
}
```

**Why:** Keeps the session mutation server-side and authenticated. We verify the caller is an admin before writing. We look up the person from the DB to avoid client-supplied name spoofing.

**Gotcha:** `getPersonById` is already exported from `lib/queries/people.ts` (line 18 of that file). Cloaking another admin is allowed per spec — no extra restriction needed here.

---

### Step 3 — `app/api/auth/uncloak/route.ts`: New endpoint to end cloaking

**File:** `/home/roeland/Projects/CarSharing/app/api/auth/uncloak/route.ts` (new file)

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  delete session.cloakedAs;
  await session.save();
  return res;
}
```

**Why:** Removes `cloakedAs` from the session cleanly. Any authenticated user can call this (harmless if not cloaked). The client-side handler navigates to `/admin` after success.

---

### Step 4 — `app/api/me/route.ts`: Return cloaked identity when active

**File:** `/home/roeland/Projects/CarSharing/app/api/me/route.ts`

**Old (lines 7–25):**
```ts
export async function GET(req: Request) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated) {
    return NextResponse.json(null);
  }

  let owner = false;
  if (session.personName) {
    owner = isOwner(getDb(), session.personName);
  }

  return NextResponse.json({
    personId: session.personId ?? null,
    personName: session.personName ?? null,
    isAdmin: session.isAdmin ?? false,
    isOwner: owner,
  });
}
```

**New:**
```ts
export async function GET(req: Request) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated) {
    return NextResponse.json(null);
  }

  const cloaked = session.cloakedAs;

  if (cloaked) {
    // While cloaked, return the cloaked person's identity.
    // isOwner is computed from their name; isAdmin reflects their actual role.
    const cloakedOwner = isOwner(getDb(), cloaked.personName);
    return NextResponse.json({
      personId: cloaked.personId,
      personName: cloaked.personName,
      isAdmin: cloaked.isAdmin,
      isOwner: cloakedOwner,
      isCloaked: true,
    });
  }

  let owner = false;
  if (session.personName) {
    owner = isOwner(getDb(), session.personName);
  }

  return NextResponse.json({
    personId: session.personId ?? null,
    personName: session.personName ?? null,
    isAdmin: session.isAdmin ?? false,
    isOwner: owner,
    isCloaked: false,
  });
}
```

**Why:** Every form and hook reads identity from `useMe()` which calls `/api/me`. By switching the returned `personId` and `personName` here, all CRUD operations automatically use the cloaked person's identity without changes to any form. The `isCloaked: true` flag lets the banner and nav distinguish cloaked state from normal admin.

**Gotcha:** The cloaked session retains the real admin's `isAdmin: true` in the cookie's `session.isAdmin`. The cloaked person's `isAdmin` is stored separately in `cloakedAs.isAdmin`. If cloaking a member (non-admin), `isAdmin` will be `false` in the `/api/me` response, so the person-selector dropdown in forms will be hidden — which is correct (the person sees their own locked name). If cloaking another admin, `isAdmin` is `true` and the admin UI is shown — also correct per spec.

---

### Step 5 — `hooks/use-me.ts`: Add `isCloaked` to `Me` type

**File:** `/home/roeland/Projects/CarSharing/hooks/use-me.ts`

**Old (lines 3–8):**
```ts
export interface Me {
  personId: number | null;
  personName: string | null;
  isAdmin: boolean;
  isOwner: boolean;
}
```

**New:**
```ts
export interface Me {
  personId: number | null;
  personName: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  isCloaked: boolean;
}
```

**Why:** Components need to check `me.isCloaked` to show the banner and transform the admin tab. The field is always present from the API (`false` when not cloaked).

**Gotcha:** `staleTime` is 5 minutes (line 16). After cloaking, the client must invalidate the `["me"]` query immediately so the UI reflects the new identity without waiting 5 minutes. The cloak/uncloak handler components must call `queryClient.invalidateQueries({ queryKey: ["me"] })` after the POST succeeds.

---

### Step 6 — `middleware.ts`: Block `/admin/*` while cloaked

**File:** `/home/roeland/Projects/CarSharing/middleware.ts`

Add the cloaked-redirect logic after the existing authenticated check. Insert after line 44 (the closing `}` of the `ADMIN_ONLY_PAGES` check):

**Old (lines 40–47):**
```ts
  // Admin-only pages — redirect non-admins to dashboard
  if (ADMIN_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return res;
```

**New:**
```ts
  // Admin-only pages — redirect non-admins to dashboard
  if (ADMIN_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // While cloaking, block /admin/* entirely (redirect to dashboard)
  if (session.cloakedAs && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
```

**Why:** Prevents an admin from reaching the Members tab while cloaked, which would let them cloak again from within a cloaked session or perform admin actions under the wrong identity. The Exit button uncloaks first, then navigates to `/admin`.

**Gotcha:** The `ADMIN_ONLY_PAGES` list (line 15) does not include `/admin` — the admin page is only protected via `session.isAdmin` implicitly through this middleware. The new check must come **after** the `ADMIN_ONLY_PAGES` check so the order is: (1) unauthenticated redirect, (2) non-admin redirect from admin-only pages, (3) cloaked redirect from `/admin`.

Also add the two new API routes to `PUBLIC_PATHS` is **not** needed — they are authenticated routes. But ensure the middleware `matcher` regex already passes through `/api/auth/cloak` and `/api/auth/uncloak` for session reading. Looking at line 52–54, the current matcher includes all paths except static assets, so these routes will be checked by middleware — that is fine because they perform their own auth checks internally.

---

### Step 7 — `components/cloak-banner.tsx`: New client component

**File:** `/home/roeland/Projects/CarSharing/components/cloak-banner.tsx` (new file)

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono } from "@/lib/paper-theme";

export function CloakBanner() {
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();

  if (!me?.isCloaked) return null;

  // Determine role label
  let roleLabel = "member";
  if (me.isOwner) roleLabel = "owner";
  else if (me.isAdmin) roleLabel = "admin";

  async function handleExit() {
    await fetch("/api/auth/uncloak", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/admin");
  }

  return (
    <div
      role="alert"
      style={{
        background: paper.amber,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        fontFamily: fontMono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        gap: 8,
      }}
    >
      <span>
        Viewing as {me.personName} ({roleLabel})
      </span>
      <button
        onClick={handleExit}
        style={{
          background: "rgba(0,0,0,0.25)",
          color: "#fff",
          border: "none",
          padding: "5px 10px",
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Exit cloaking
      </button>
    </div>
  );
}
```

**Why:** A self-contained client component that only renders when `isCloaked` is true. Using `role="alert"` makes the banner accessible. The amber background (`paper.amber = "#b87e0f"`) matches the existing theme and signals a temporary/warning state without being alarming.

**Gotcha:** `router.push("/admin")` works even though middleware redirects `/admin` while cloaked — by the time the navigation occurs, the POST to `/api/auth/uncloak` has already saved the session without `cloakedAs`. The browser then loads `/admin` with the restored admin session. There is a brief window between the `fetch` completing and the `router.push` where a race is theoretically possible — this is harmless in practice. If needed, `router.refresh()` can be added before `router.push` to force a server-side session re-read.

---

### Step 8 — `app/layout.tsx`: Render `<CloakBanner />` inside the page container

**File:** `/home/roeland/Projects/CarSharing/app/layout.tsx`

**Old (lines 5–6, imports section):**
```tsx
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { LocaleProvider } from "@/components/locale-provider";
```

**New:**
```tsx
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CloakBanner } from "@/components/cloak-banner";
import { LocaleProvider } from "@/components/locale-provider";
```

**Old (lines 55–66, the inner `div` content):**
```tsx
          <div
            style={{
              minHeight: "100dvh",
              maxWidth: 480,
              margin: "0 auto",
              background: "var(--paper-deep)",
              position: "relative",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
              paddingBottom: 72,
            }}
          >
            {children}
          </div>
```

**New:**
```tsx
          <div
            style={{
              minHeight: "100dvh",
              maxWidth: 480,
              margin: "0 auto",
              background: "var(--paper-deep)",
              position: "relative",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
              paddingBottom: 72,
            }}
          >
            <CloakBanner />
            {children}
          </div>
```

**Why:** Placing the banner at the very top of the content `div` (above `{children}`) means it appears on every page without modifying individual page components. It is inside the constrained `maxWidth: 480` container, so it aligns with the app's layout.

**Gotcha:** The banner only renders when `me?.isCloaked` is true, so it adds zero DOM overhead for normal sessions. The banner is a client component that uses `useMe()`, so it participates in React Query's caching — no extra fetch is needed.

---

### Step 9 — `components/bottom-tab-bar.tsx`: Transform Admin tab to Exit-cloaking

**File:** `/home/roeland/Projects/CarSharing/components/bottom-tab-bar.tsx`

**Old (lines 1–84, full file):**

The key changes are:

1. Import `useQueryClient` and `useRouter`.
2. Read `me.isCloaked` from `useMe()`.
3. When `isCloaked`, replace the Admin tab link with a button that calls uncloak.

**New full file:**
```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useMe } from "@/hooks/use-me";

const BASE_TABS = [
  { href: "/",         labelKey: "nav.dashboard" as const,        icon: "◉" },
  { href: "/trips",    labelKey: "nav.trips" as const,             icon: "↦" },
  { href: "/fuel",     labelKey: "nav.fuel" as const,              icon: "⛽" },
  { href: "/calendar", labelKey: "nav.tab.reservations" as const,  icon: "▦" },
  { href: "/expenses", labelKey: "nav.tab.expenses" as const,      icon: "₪" },
];

const ADMIN_TAB = { href: "/admin", labelKey: "nav.admin" as const, icon: "✎" };

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "10px 2px 12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  fontFamily: fontMono,
  background: active ? paper.ink : "transparent",
  color: active ? paper.paper : paper.ink,
  textDecoration: "none",
  minWidth: 0,
  cursor: "pointer",
  border: "none",
});

const labelStyle: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

export function BottomTabBar() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();

  if (pathname === "/login" || pathname.startsWith("/invite")) return null;

  const showAdmin = (me?.isAdmin || me?.isOwner) && !me?.isCloaked;
  const tabs = showAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  async function handleExitCloak() {
    await fetch("/api/auth/uncloak", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/admin");
  }

  return (
    <nav
      aria-label={t("nav.primary")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: paper.paper,
        borderTop: `1.5px dashed ${paper.ink}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {tabs.map(({ href, labelKey, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            style={tabStyle(active)}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
            <span style={labelStyle}>{t(labelKey)}</span>
          </Link>
        );
      })}
      {me?.isCloaked && (
        <button
          onClick={handleExitCloak}
          style={{
            ...tabStyle(false),
            background: paper.amber,
            color: "#fff",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>✕</span>
          <span style={labelStyle}>Exit</span>
        </button>
      )}
    </nav>
  );
}
```

**Why:** When cloaked, the admin tab (which would link to `/admin`) must not appear — middleware would redirect it anyway. Instead, an Exit button appears in the same position (after the 5 base tabs) with amber background to match the banner. The button calls the same `handleExitCloak` logic as the banner button.

**Gotcha:** The original code used inline style objects directly on `Link`. To avoid duplication between the regular tabs and the exit button, the style is extracted into a `tabStyle()` helper. The `tabStyle` function is defined with `React.CSSProperties` — this requires no additional import because it is a type-only reference available from `react`. However, since this is a `.tsx` file, React types are already in scope.

The `showAdmin` variable now correctly gates the admin tab: it only appears when the user is admin/owner **and** not cloaked. This replaces the previous line 25: `const tabs = (me?.isAdmin || me?.isOwner) ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;`

---

### Step 10 — Translation keys: `lib/i18n/messages/nl.ts` and `en.ts`

**File:** `/home/roeland/Projects/CarSharing/lib/i18n/messages/nl.ts`

Add after line 373 (`"admin.no_username": "Nog geen login",`), before the closing `} as const`:

```ts
  // Cloaking
  "cloak.viewing_as": "Kijken als {name} ({role})",
  "cloak.exit": "Stop met kijken",
  "cloak.button": "Bekijk als lid",
  "cloak.role_member": "lid",
  "cloak.role_admin": "admin",
  "cloak.role_owner": "eigenaar",
```

**File:** `/home/roeland/Projects/CarSharing/lib/i18n/messages/en.ts`

Add the same keys (English values):

```ts
  // Cloaking
  "cloak.viewing_as": "Viewing as {name} ({role})",
  "cloak.exit": "Exit cloaking",
  "cloak.button": "View as member",
  "cloak.role_member": "member",
  "cloak.role_admin": "admin",
  "cloak.role_owner": "owner",
```

**Why:** The banner currently hard-codes English strings. For consistency with the rest of the app that uses `useT()` / `t()`, these should be translation keys. The `CloakBanner` component can be updated to use `t("cloak.viewing_as", { name: me.personName, role: t("cloak.role_" + roleKey) })` once the keys are added.

**Note on `MessageKey` type:** `nl.ts` line 376 derives `MessageKey = keyof typeof nl`. Adding keys to the `nl` object automatically widens the union, and `en.ts` implements `Messages = Record<MessageKey, string>` — so TypeScript will error on `en.ts` until the English keys are also added. Add both files in the same edit.

---

### Step 11 — `app/admin/page.tsx`: Add "Cloak" button to `PersonCard`

**File:** `/home/roeland/Projects/CarSharing/app/admin/page.tsx`

The `PersonCard` component starts at line 1122. The `Members` component passes `onSave` but not a cloak handler. We need to:

1. Pass an `onCloak` prop to `PersonCard`.
2. Add a button inside the card's action row.
3. Wire `onCloak` in `Members` to call `/api/auth/cloak` and invalidate `["me"]`.

**Change A — `Members` function (around lines 1076–1120):**

Add the `useQueryClient`, `useRouter` imports at the top of the file (check existing imports first), then modify `Members`:

```tsx
// Add at top of file with other imports if not present:
// import { useQueryClient } from "@tanstack/react-query";
// import { useRouter } from "next/navigation";

function Members() {
  const t = useT();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();
  const router = useRouter();

  const savePerson = useMutation({
    mutationFn: async (p: Person) => {
      const res = await fetch(`/api/people/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, discount: p.discount, discount_long: p.discount_long,
          active: p.active, username: p.username, is_admin: p.is_admin,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success(t("toast.saved")); },
  });

  async function handleCloak(personId: number) {
    const res = await fetch("/api/auth/cloak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/");
  }

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);

  return (
    <div style={{ padding: "16px" }}>
      {active.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          onSave={(p) => savePerson.mutate(p)}
          onCloak={handleCloak}
        />
      ))}
      {inactive.length > 0 && (
        <>
          <div style={{
            fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2,
            textTransform: "uppercase", padding: "16px 0 8px",
            borderTop: `1.5px dashed ${paper.inkMute}`, marginTop: 8,
          }}>
            {t("admin.inactive_section")}
          </div>
          {inactive.map((person) => (
            <PersonCard key={person.id} person={person} onSave={(p) => savePerson.mutate(p)} />
          ))}
        </>
      )}
    </div>
  );
}
```

**Change B — `PersonCard` function signature (line 1122):**

Old:
```tsx
function PersonCard({ person, onSave }: { person: Person; onSave: (p: Person) => void }) {
```

New:
```tsx
function PersonCard({
  person,
  onSave,
  onCloak,
}: {
  person: Person;
  onSave: (p: Person) => void;
  onCloak?: (personId: number) => void;
}) {
```

**Change C — Add Cloak button inside the active card's action row (currently lines 1263–1288):**

The existing action row renders a Save button (conditionally when `dirty`) and a Deactivate button. Add the Cloak button after Deactivate:

Old (lines 1263–1288):
```tsx
      <div style={{ display: "flex", gap: 8 }}>
        {dirty && (
          <button
            onClick={() => onSave({
              ...person,
              discount: disc, discount_long: discLong,
              username: username || null, is_admin: isAdmin ? 1 : 0,
            })}
            style={{
              flex: 1, padding: "10px", background: paper.ink, color: paper.paper,
              border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10,
              fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            }}>
            {t("action.save")}
          </button>
        )}
        <button
          onClick={() => onSave({ ...person, discount: disc, discount_long: discLong, active: 0 })}
          style={{
            padding: "10px 14px", background: "transparent", color: paper.inkMute,
            border: `1px solid ${paper.paperDark}`, cursor: "pointer",
            fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
          }}>
          {t("admin.deactivate")}
        </button>
      </div>
```

New:
```tsx
      <div style={{ display: "flex", gap: 8 }}>
        {dirty && (
          <button
            onClick={() => onSave({
              ...person,
              discount: disc, discount_long: discLong,
              username: username || null, is_admin: isAdmin ? 1 : 0,
            })}
            style={{
              flex: 1, padding: "10px", background: paper.ink, color: paper.paper,
              border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10,
              fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            }}>
            {t("action.save")}
          </button>
        )}
        <button
          onClick={() => onSave({ ...person, discount: disc, discount_long: discLong, active: 0 })}
          style={{
            padding: "10px 14px", background: "transparent", color: paper.inkMute,
            border: `1px solid ${paper.paperDark}`, cursor: "pointer",
            fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
          }}>
          {t("admin.deactivate")}
        </button>
        {onCloak && (
          <button
            onClick={() => onCloak(person.id)}
            style={{
              padding: "10px 14px", background: "transparent", color: paper.blue,
              border: `1px solid ${paper.blue}`, cursor: "pointer",
              fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
            }}>
            👁
          </button>
        )}
      </div>
```

**Why:** Inactive members cannot be logged in to, so `onCloak` is only passed for active members. The eye icon (`👁`) with a blue border is visually distinct from save/deactivate without cluttering the card. `onCloak` is `undefined` for inactive cards so the button doesn't appear there.

**Gotcha:** Check the existing imports in `app/admin/page.tsx`. `useQueryClient` and `useMutation` are already imported (visible at line 1079: `const qc = useQueryClient()`). Verify `useRouter` is imported — if not, add `import { useRouter } from "next/navigation";` near the top.

**Finding from reading the file:** `useQueryClient` is already used in `Members` (line 1079). `useMutation` is imported. `useRouter` should be checked separately — scan the imports at the top of `app/admin/page.tsx` to confirm.

---

## 4. Form `person_id` Analysis

All four forms use the same pattern:

1. On mount (via `useEffect`), if in add-mode and `me.personId` exists and no `person_id` is already set, the form calls `setValue("person_id", me.personId)`.
2. For admins (`me.isAdmin === true`), a `<select>` dropdown is shown allowing override.
3. For non-admins, the person field is locked (displays name with a lock icon, no interaction).
4. The `person_id` is submitted as part of the form payload to the API, which reads it from the request body.

### TripForm (`app/trips/trip-form.tsx`)

- **Lines 94–98:** `useEffect` sets `person_id` from `me.personId` on mount in add-mode.
- **Lines 141–161:** Admin sees a `<select>` with all active people; non-admin sees locked name.
- **Submit:** `handleSubmit(onSubmit)` passes the form's `person_id` directly to `onSubmit`. The API (`app/api/trips/route.ts`) reads `person_id` from the request body.
- **Cloaking behavior:** When cloaking a non-admin, `me.isAdmin` will be `false` → locked field showing cloaked person's name. `me.personId` is the cloaked person's ID, so it is pre-filled correctly. **No changes needed.**
- **Cloaking an admin:** `me.isAdmin` will be `true` → dropdown shown, pre-selected to cloaked admin's `personId`. This is correct per spec (full CRUD while cloaked). **No changes needed.**

### FuelForm (`app/fuel/fuel-form.tsx`)

- **Lines 84–88:** Same `useEffect` pattern as TripForm.
- **Lines 143–162:** Same admin/non-admin conditional rendering.
- **Submit (lines 92–105):** Explicit `handleSubmitForm` wrapper passes `data.person_id` to `onSubmit`. API reads from body.
- **Cloaking behavior:** Identical to TripForm. **No changes needed.**

### ExpenseForm (`app/expenses/expense-form.tsx`)

- **Lines 67–71:** Same `useEffect` pattern.
- **Lines 111–130:** Same conditional rendering.
- **Submit (line 74):** `handleSubmit(onSubmit as any)` — form data including `person_id` is passed directly. API reads from body.
- **Cloaking behavior:** Identical. **No changes needed.**

### ReservationForm (`app/calendar/reservation-form.tsx`)

- **Lines 67–71:** `useEffect` sets `person_id` from `me.personId` when not in edit-mode and no ID pre-supplied.
- **Lines 135–154:** Same admin/non-admin pattern.
- **Submit (lines 92–100):** `handleFormSubmit` explicitly picks `data.person_id` and passes to `onSubmit`. API reads from body.
- **Cloaking behavior:** Identical. **No changes needed.**

### Summary

**No form changes are required.** All forms read `me.personId` for their pre-fill effect and `me.isAdmin` for the driver-selector lock. After Step 4 (modifying `/api/me`), these values automatically reflect the cloaked person's identity when cloaking is active. The API routes for trips, fuel, expenses, and reservations all accept `person_id` from the request body and do not cross-check it against the session.

---

## 5. Testing Checklist

### Setup
- [ ] Ensure at least two people in the DB: one admin (the tester) and one or more active members.
- [ ] Log in as admin.

### Cloaking initiation
- [ ] Navigate to `/admin` → Members tab.
- [ ] Confirm the 👁 button appears on active member cards and is absent on inactive member cards.
- [ ] Tap 👁 on a non-admin member. Verify redirect to `/`.
- [ ] Confirm amber banner appears at the top of the page showing "Viewing as [name] (member)".
- [ ] Confirm the Admin tab in the bottom nav is replaced by an amber "Exit" button.
- [ ] Confirm the admin tab for `/admin` is gone from the tab bar.
- [ ] Attempt direct navigation to `/admin` in the browser — verify redirect to `/`.

### CRUD while cloaked (as non-admin member)
- [ ] Open the Trip form: confirm the driver field shows the cloaked person's name and is locked (lock icon visible).
- [ ] Save a trip: confirm the saved trip has `person_id` of the cloaked person (check DB or dashboard).
- [ ] Open the Fuel form: same lock check, save a fuel fillup, verify person_id.
- [ ] Open the Expense form: same check.
- [ ] Open the Reservation form: same check.
- [ ] Confirm existing edit flows (tapping an existing record) still work and show correct data.

### Page refresh persistence
- [ ] While cloaked, hard-refresh the browser (`Ctrl+Shift+R`).
- [ ] Confirm the amber banner reappears immediately after refresh.
- [ ] Confirm the Admin tab is still replaced by Exit.
- [ ] Confirm `/admin` still redirects to `/`.

### Cloaking an admin
- [ ] Return to normal session (use Exit button or direct uncloak).
- [ ] Cloak another admin-role person.
- [ ] Confirm the driver dropdown is shown (not locked) in forms (because `isAdmin` is `true`).
- [ ] Confirm the admin tab is still replaced by Exit (not a real Admin tab link).
- [ ] Confirm `/admin` still redirects to `/`.

### Exit cloaking (via banner)
- [ ] While cloaked, tap "Exit cloaking" in the amber banner.
- [ ] Confirm redirect to `/admin`.
- [ ] Confirm banner disappears.
- [ ] Confirm Admin tab reappears in the bottom nav.
- [ ] Confirm `/admin` is now accessible.

### Exit cloaking (via bottom nav Exit button)
- [ ] Cloak again. Tap the amber Exit button in the bottom nav.
- [ ] Same checks as above.

### Edge cases
- [ ] Confirm logging out while cloaked destroys the entire session (the logout route calls `session.destroy()` which wipes everything including `cloakedAs`). After logout and re-login, no cloaking is active.
- [ ] Confirm a non-admin cannot call `POST /api/auth/cloak` (should receive 403).
- [ ] Confirm an unauthenticated request to `POST /api/auth/cloak` returns 403.
- [ ] Confirm `POST /api/auth/uncloak` with no active cloaking is harmless (200 ok, no change).
- [ ] Confirm the `useMe` cache is invalidated after cloak/uncloak so the UI updates within the same session without a page refresh.
