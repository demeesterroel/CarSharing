# Offline Phase 1 — Read-Only Browsing & Status Indicator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the app to be opened, navigated, and read fully offline after a single online visit, with a clear staleness-aware status indicator in the page header.

**Architecture:** Three layered freshness mechanisms — (1) the service worker uses `StaleWhileRevalidate` for all data API GETs so cached responses are served instantly while the network refreshes in the background; (2) a boot-time React Query `prefetchQuery` fan-out warms every critical endpoint within a few seconds of app start; (3) write-path forms (`Add Trip`, `Add Reservation`) refetch their dependency data on mount when online so users committing data always work from fresh server state. A new React context tracks online/offline transitions and the cache age, driving a 3-state badge in the header.

**Tech Stack:** Next.js 15 App Router · `@ducanh2912/next-pwa` (Workbox runtime caching) · React Query v5 · React 19 context · vitest

**Closes:** Issue #8

**Branch:** `feature/offline-phase-1`

---

## Architectural decisions (locked-in)

- **Cache strategy:** `StaleWhileRevalidate` for `/api/*` GETs (excluding `/api/auth/*` and `/api/me`, which stay `NetworkFirst` so auth state isn't stale).
- **Prewarm trigger:** App mount, after auth confirmed (`useMe` returns a user). Fires once per session in parallel.
- **Stale threshold:** `dataUpdatedAt` minimum across critical queries; `< 1h` = fresh, `≥ 1h` = stale.
- **Offline detection:** Browser `online`/`offline` events for instant transitions; periodic 30s heartbeat (`HEAD /api/health`) for captive-portal correction.
- **Indicator placement:** `PageHeader`'s `right` slot, visually before `LangSwitcher`.
- **Form-open refetch scope:** Only forms whose correctness depends on freshness (`Add Trip` → `lastCarState`; `Add Reservation` → `reservations`). Fuel/Expenses do not need this.
- **No new client state library:** Use React Query's existing cache + a thin React context for online/staleness. Do not introduce zustand/jotai/etc.

---

## File Structure

**New files:**
- `app/api/health/route.ts` — minimal unauthenticated GET endpoint for heartbeat checks.
- `lib/offline/online-state.tsx` — React context, hooks, and `OnlineStateProvider`.
- `lib/offline/online-state.test.ts` — unit tests for the state-machine logic (extracted to a pure function).
- `lib/offline/prewarm.ts` — boot-time prefetch helper (`prewarmCriticalEndpoints`) and `useBootPrewarm` hook.
- `lib/offline/prewarm.test.ts` — unit tests using a real `QueryClient` and `fetch` mock.
- `components/offline-badge.tsx` — header indicator (3 states for Phase 1).

**Modified files:**
- `next.config.ts` — add `workboxOptions.runtimeCaching` rules for the API endpoints.
- `app/providers.tsx` — wrap children in `OnlineStateProvider`, mount `useBootPrewarm`.
- `components/page-header.tsx` — render `<OfflineBadge />` to the left of `LangSwitcher`.
- `app/trips/trip-form.tsx` (or wherever the `Add Trip` form lives) — refetch `useLastCarState(carId)` on mount when online.
- `app/calendar/page.tsx` (the `?action=reserve` path) — refetch reservations on form mount when online.
- `lib/i18n/messages/nl.ts`, `lib/i18n/messages/en.ts` — add 6 new keys for the indicator and form staleness hint.

**Tests:**
- `lib/offline/online-state.test.ts`
- `lib/offline/prewarm.test.ts`
- `app/api/health/route.test.ts` (smoke test)

---

## Build sequence

Phase 1 is structured so each task produces working code. Tasks 1–3 establish the runtime state machine; Task 4 flips the cache strategy; Task 5–6 add prewarm; Task 7–8 add the visible indicator; Task 9–10 protect write paths; Task 11 is QA. Order matters because Task 8 depends on Task 7's component, and Task 9–10 depend on Task 2's `useOnlineState` hook.

---

### Task 1: Health endpoint

**Files:**
- Create: `app/api/health/route.ts`
- Test: `app/api/health/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/health/route.test.ts
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not require auth (no Set-Cookie or auth headers)", async () => {
    const res = await GET();
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/offline app/api/health 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Update middleware to whitelist this endpoint**

Read `middleware.ts` and add `/api/health` to the public-paths list (alongside `/api/auth/*`, `/manifest.json`, `/sw.js`). Exact pattern depends on the existing matcher; the route must respond 200 even without a session cookie.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app/api/health`
Expected: PASS (2/2)

- [ ] **Step 6: Manual smoke test**

Run dev server, then in another terminal:
```bash
curl -i http://localhost:3000/api/health
```
Expected: `HTTP/1.1 200 OK`, body `{"ok":true}`, no `Set-Cookie`.

- [ ] **Step 7: Commit**

```bash
git add app/api/health/route.ts app/api/health/route.test.ts middleware.ts
git commit -m "feat(api): add /api/health unauthenticated heartbeat endpoint"
```

---

### Task 2: Online state — pure logic + tests

The state machine has three observable values: `online: boolean`, `lastSyncAt: number | null`, and `isStale: boolean`. We extract the calculation into a pure function so it's trivially testable in `node` env (no DOM needed).

**Files:**
- Create: `lib/offline/online-state.tsx`
- Create: `lib/offline/online-state.test.ts`

- [ ] **Step 1: Write failing tests for the pure helpers**

```ts
// lib/offline/online-state.test.ts
import { describe, it, expect } from "vitest";
import { computeStaleness, STALE_THRESHOLD_MS } from "./online-state";

describe("computeStaleness", () => {
  it("returns 'fresh' when sync was within threshold", () => {
    const now = 1_700_000_000_000;
    expect(computeStaleness(now - 60_000, now)).toBe("fresh");
  });

  it("returns 'stale' when sync was older than threshold", () => {
    const now = 1_700_000_000_000;
    expect(computeStaleness(now - STALE_THRESHOLD_MS - 1, now)).toBe("stale");
  });

  it("returns 'unknown' when never synced", () => {
    expect(computeStaleness(null, 1_700_000_000_000)).toBe("unknown");
  });

  it("treats exact threshold boundary as 'fresh'", () => {
    const now = 1_700_000_000_000;
    expect(computeStaleness(now - STALE_THRESHOLD_MS, now)).toBe("fresh");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/offline/online-state`
Expected: FAIL — module not found

- [ ] **Step 3: Implement minimal helpers + context skeleton**

```tsx
// lib/offline/online-state.tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const HEARTBEAT_INTERVAL_MS = 30 * 1000;          // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 5 * 1000;            // 5 seconds

export type Staleness = "fresh" | "stale" | "unknown";

export function computeStaleness(lastSyncAt: number | null, now: number): Staleness {
  if (lastSyncAt === null) return "unknown";
  return now - lastSyncAt <= STALE_THRESHOLD_MS ? "fresh" : "stale";
}

export interface OnlineState {
  online: boolean;
  lastSyncAt: number | null;
  staleness: Staleness;
  markSynced: () => void;
}

const Ctx = createContext<OnlineState | null>(null);

export function useOnlineState(): OnlineState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOnlineState must be used inside OnlineStateProvider");
  return v;
}

async function heartbeat(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/health", { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function OnlineStateProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const markSynced = useCallback(() => setLastSyncAt(Date.now()), []);

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  // Heartbeat: validates that we actually have connectivity (catches captive portals).
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const ok = await heartbeat();
      if (!cancelled) setOnline(ok);
    }, HEARTBEAT_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [online]);

  // Tick `now` once a minute so staleness updates without remounts.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const value: OnlineState = {
    online,
    lastSyncAt,
    staleness: computeStaleness(lastSyncAt, now),
    markSynced,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/offline/online-state`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/online-state.tsx lib/offline/online-state.test.ts
git commit -m "feat(offline): online-state context with heartbeat and staleness"
```

---

### Task 3: Wire OnlineStateProvider into the app

**Files:**
- Modify: `app/providers.tsx`

- [ ] **Step 1: Wrap Providers with OnlineStateProvider**

```tsx
// app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { OnlineStateProvider } from "@/lib/offline/online-state";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <OnlineStateProvider>
        {children}
        <Toaster position="bottom-center" />
      </OnlineStateProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Verify nothing breaks**

Run: `npm test`
Expected: all existing tests pass.

Run: `npm run dev` and load `/` — page should load normally; no console errors.

- [ ] **Step 3: Commit**

```bash
git add app/providers.tsx
git commit -m "feat(offline): wire OnlineStateProvider into app shell"
```

---

### Task 4: Switch SW runtime caching to StaleWhileRevalidate for data APIs

This is the load-bearing change. The current SW uses `NetworkFirst` for `/api/*` (10s timeout, then cache). We swap to `StaleWhileRevalidate` for *data* endpoints so cached data is served instantly. Auth and identity endpoints stay `NetworkFirst` so the user can't get stuck logged-in after their session is revoked.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add explicit runtime caching rules**

```ts
// next.config.ts
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    importScripts: ["/sw-helpers.js"],
    runtimeCaching: [
      // Auth & identity — must always reflect latest server state.
      {
        urlPattern: ({ url }) =>
          url.pathname === "/api/me" || url.pathname.startsWith("/api/auth/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api-auth",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
        },
      },
      // Health endpoint — never cache (used as a heartbeat).
      {
        urlPattern: ({ url }) => url.pathname === "/api/health",
        handler: "NetworkOnly",
      },
      // Data APIs — serve cache instantly, refresh in background.
      {
        urlPattern: ({ url, request, sameOrigin }) =>
          sameOrigin && request.method === "GET" && url.pathname.startsWith("/api/"),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-data",
          expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
    ],
  },
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!icons/source.svg"],
});

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/:path*" },
    ];
  },
};

export default withPWA(nextConfig);
```

- [ ] **Step 2: Verify the SW regenerates**

```bash
rm -rf .next public/sw.js public/workbox-*.js
npm run build 2>&1 | tail -20
ls public/sw.js public/workbox-*.js
grep -c "StaleWhileRevalidate" public/sw.js
```
Expected: build succeeds, `sw.js` regenerated, contains `StaleWhileRevalidate`.

- [ ] **Step 3: Manual offline test (must pass before continuing)**

```bash
npm run start  # production server, SW is active
```

In Chrome with a fresh profile or incognito + DevTools:
1. Visit `http://localhost:3000/`, log in
2. Navigate to `/trips`, `/fuel`, `/expenses`, `/calendar`
3. DevTools → Application → Service Workers → tick **Offline**
4. Click each tab in the bottom bar — every list should still render
5. Click a trip in the list — the edit sheet should open with correct data

If any tab shows `ERR_FAILED`, the SW config is wrong; fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(pwa): StaleWhileRevalidate for data APIs, NetworkFirst for auth"
```

---

### Task 5: Boot-time prewarm helper

**Files:**
- Create: `lib/offline/prewarm.ts`
- Create: `lib/offline/prewarm.test.ts`

The prewarm function takes a `QueryClient` and a list of endpoint specs, fires them in parallel via `prefetchQuery`, and resolves when all complete (or fail). Test it with a fake fetcher.

- [ ] **Step 1: Write failing tests**

```ts
// lib/offline/prewarm.test.ts
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prewarmCriticalEndpoints, CRITICAL_ENDPOINTS } from "./prewarm";

describe("prewarmCriticalEndpoints", () => {
  it("calls fetcher for every critical endpoint in parallel", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const qc = new QueryClient();
    await prewarmCriticalEndpoints(qc, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(CRITICAL_ENDPOINTS.length);
    for (const ep of CRITICAL_ENDPOINTS) {
      expect(fetcher).toHaveBeenCalledWith(ep.url);
    }
  });

  it("does not throw when an individual fetch fails", async () => {
    const fetcher = vi.fn().mockImplementation((url: string) =>
      url.includes("trips") ? Promise.reject(new Error("boom")) : Promise.resolve([])
    );
    const qc = new QueryClient();
    await expect(prewarmCriticalEndpoints(qc, fetcher)).resolves.toBeDefined();
  });

  it("populates the QueryClient cache for successful fetches", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
    const qc = new QueryClient();
    await prewarmCriticalEndpoints(qc, fetcher);
    const tripsState = qc.getQueryState(["trips"]);
    expect(tripsState?.data).toEqual([{ id: 1 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/offline/prewarm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement prewarm**

```ts
// lib/offline/prewarm.ts
"use client";
import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineState } from "./online-state";

export interface CriticalEndpoint {
  queryKey: readonly unknown[];
  url: string;
}

export const CRITICAL_ENDPOINTS: readonly CriticalEndpoint[] = [
  { queryKey: ["dashboard"],     url: "/api/dashboard" },
  { queryKey: ["trips"],         url: "/api/trips" },
  { queryKey: ["fuel"],          url: "/api/fuel" },
  { queryKey: ["expenses"],      url: "/api/expenses" },
  { queryKey: ["reservations"],  url: "/api/reservations" },
  { queryKey: ["people"],        url: "/api/people" },
  { queryKey: ["cars"],          url: "/api/cars" },
] as const;

export type Fetcher = (url: string) => Promise<unknown>;

export async function prewarmCriticalEndpoints(
  qc: QueryClient,
  fetcher: Fetcher = defaultFetcher
): Promise<PromiseSettledResult<unknown>[]> {
  const tasks = CRITICAL_ENDPOINTS.map((ep) =>
    qc.prefetchQuery({ queryKey: ep.queryKey, queryFn: () => fetcher(ep.url) })
      .then(() => qc.getQueryData(ep.queryKey))
  );
  return Promise.allSettled(tasks);
}

async function defaultFetcher(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export function useBootPrewarm(authReady: boolean) {
  const qc = useQueryClient();
  const { online, markSynced } = useOnlineState();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!authReady || !online) return;
    ranRef.current = true;
    prewarmCriticalEndpoints(qc).then((results) => {
      const anyOk = results.some((r) => r.status === "fulfilled");
      if (anyOk) markSynced();
    });
  }, [authReady, online, qc, markSynced]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/offline/prewarm`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/prewarm.ts lib/offline/prewarm.test.ts
git commit -m "feat(offline): boot-time prewarm of critical API endpoints"
```

---

### Task 6: Mount the prewarm hook

**Files:**
- Modify: `app/providers.tsx`

The hook needs `authReady = true`, which means a successful `useMe` call. Mount it inside an inner client component so it has access to context.

- [ ] **Step 1: Add a `BootPrewarm` mounter inside `Providers`**

```tsx
// app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { OnlineStateProvider } from "@/lib/offline/online-state";
import { useBootPrewarm } from "@/lib/offline/prewarm";

function BootPrewarm() {
  // useMe is the auth signal. Read it here so prewarm gates on auth.
  const { data, isFetched } = useQuery<{ personId: number | null } | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  useBootPrewarm(isFetched && data?.personId != null);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <OnlineStateProvider>
        <BootPrewarm />
        {children}
        <Toaster position="bottom-center" />
      </OnlineStateProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`. Log in. Open DevTools → Network → filter `/api/`. Within ~1s of dashboard load you should see GETs to `/api/trips`, `/api/fuel`, `/api/expenses`, `/api/reservations`, `/api/people`, `/api/cars` (in addition to whatever the dashboard itself triggered).

- [ ] **Step 3: Commit**

```bash
git add app/providers.tsx
git commit -m "feat(offline): trigger boot-time prewarm after auth resolved"
```

---

### Task 7: Offline badge component (3 states)

Three states for Phase 1: `null` (online + fresh, render nothing), `offline-fresh` (grey), `offline-stale` (amber). Pure presentational — receives state via `useOnlineState`.

**Files:**
- Create: `components/offline-badge.tsx`
- Modify: `lib/i18n/messages/nl.ts`, `lib/i18n/messages/en.ts`

- [ ] **Step 1: Add i18n keys**

```ts
// lib/i18n/messages/nl.ts (add to the export map)
"offline.label": "OFFLINE",
"offline.stale_suffix": "ouder dan 1u",
"offline.tooltip_fresh": "Je bent offline. Gegevens zijn recent gesynchroniseerd.",
"offline.tooltip_stale": "Je bent offline en de gegevens zijn ouder dan een uur.",
```

```ts
// lib/i18n/messages/en.ts
"offline.label": "OFFLINE",
"offline.stale_suffix": "data >1h old",
"offline.tooltip_fresh": "You are offline. Data was recently synced.",
"offline.tooltip_stale": "You are offline and the data is over an hour old.",
```

- [ ] **Step 2: Implement the badge**

```tsx
// components/offline-badge.tsx
"use client";
import { useOnlineState } from "@/lib/offline/online-state";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export function OfflineBadge() {
  const t = useT();
  const { online, staleness } = useOnlineState();

  if (online) return null;

  const isStale = staleness === "stale" || staleness === "unknown";
  const color = isStale ? paper.amber : paper.inkDim;
  const tooltip = isStale ? t("offline.tooltip_stale") : t("offline.tooltip_fresh");

  return (
    <span
      role="status"
      aria-live="polite"
      title={tooltip}
      style={{
        padding: "3px 8px",
        fontFamily: fontMono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        background: "transparent",
        color,
        border: `1.5px solid ${color}`,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {t("offline.label")}{isStale && ` · ${t("offline.stale_suffix")}`}
    </span>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Run dev, log in, open `/`. DevTools → Network → set throttling to **Offline**. Within a second the page header gains the `OFFLINE` badge. Restore network — badge disappears.

- [ ] **Step 4: Commit**

```bash
git add components/offline-badge.tsx lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git commit -m "feat(offline): header badge with fresh/stale states"
```

---

### Task 8: Wire badge into PageHeader

**Files:**
- Modify: `components/page-header.tsx`

The badge goes into the existing `right` slot of the header, before `LangSwitcher`.

- [ ] **Step 1: Add OfflineBadge to header**

```tsx
// components/page-header.tsx — change the right-side cluster
import { OfflineBadge } from "./offline-badge";

// inside the header JSX, replace:
//   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//     {right}
//     <LangSwitcher />
//     <button onClick={handleLogout} ...>⏻</button>
//   </div>
// with:
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <OfflineBadge />
          {right}
          <LangSwitcher />
          <button
            onClick={handleLogout}
            title={t("nav.logout")}
            style={{ /* unchanged */ }}
          >
            ⏻
          </button>
        </div>
```

- [ ] **Step 2: Manual verification on every page**

Run dev, log in, toggle DevTools offline mode, visit each page. Badge should appear/disappear consistently across `/`, `/trips`, `/fuel`, `/expenses`, `/calendar`, `/admin`.

- [ ] **Step 3: Commit**

```bash
git add components/page-header.tsx
git commit -m "feat(offline): show OfflineBadge in every page header"
```

---

### Task 9: Trip form — refetch lastCarState on mount when online

**Files:**
- Modify: the trip form file (likely `app/trips/trip-form.tsx`)

First find the form. The plan assumes it uses a hook like `useLastCarState(carId)` to populate `start_odometer`. Confirm by inspecting before editing.

- [ ] **Step 1: Locate the trip form and its dependency hook**

Run:
```bash
grep -rn "last-state\|lastCarState\|useLastState" app/ hooks/ --include="*.tsx" --include="*.ts"
```

Identify the file that opens the `Add Trip` form and the hook it calls. The form file path goes into "Files: Modify" above.

- [ ] **Step 2: Add a freshening effect inside the form component**

Append this hook usage to the form's top-level effects (just below existing hook calls):

```tsx
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineState } from "@/lib/offline/online-state";

// inside the form component:
const qc = useQueryClient();
const { online } = useOnlineState();

useEffect(() => {
  if (!online) return;
  if (carId == null) return;
  // Force a fresh fetch of the car's last state — overrides any staleTime.
  qc.invalidateQueries({ queryKey: ["lastCarState", carId] });
}, [online, carId, qc]);
```

If the existing query key shape differs (e.g. `["cars", carId, "lastState"]`), adapt the key. Confirm the exact key by reading the hook found in Step 1.

- [ ] **Step 3: Add a small "last synced" hint when offline**

In the form, near the `start_odometer` input, render a hint when offline:

```tsx
import { useT } from "@/components/locale-provider";

// new i18n keys (add in nl.ts and en.ts):
//   "form.offline_start_km_hint": "Offline — start KM is van laatste sync."
//   "form.offline_start_km_hint": "Offline — start KM is from last sync."

// near the start_odometer input:
{!online && (
  <div style={{
    fontFamily: fontMono, fontSize: 9, color: paper.amber,
    letterSpacing: 1, marginTop: 2, textTransform: "uppercase",
  }}>
    {t("form.offline_start_km_hint")}
  </div>
)}
```

- [ ] **Step 4: Manual verification**

Run dev, log a trip with car X, save. Wait long enough that staleTime expires for `lastCarState` (or just open the form). Verify the network panel shows a `GET /api/cars/X/last-state` *every time* the form opens, not just the first.

Then: go offline (DevTools), open form — request fails, `start_odometer` falls back to cached value, hint message visible.

- [ ] **Step 5: Commit**

```bash
git add <trip-form-file> lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git commit -m "feat(offline): refetch lastCarState on trip form open + offline hint"
```

---

### Task 10: Reservation form — refetch reservations on mount when online

**Files:**
- Modify: `app/calendar/page.tsx` (the `?action=reserve` flow)

Same pattern: when the new-reservation sheet opens (controlled by `searchParams.get("action") === "reserve"` per the deep-linking work), force a refetch of `["reservations"]` if online.

- [ ] **Step 1: Add the freshening effect to the reservation flow**

Inside the calendar page's content component, near where the sheet opens:

```tsx
const qc = useQueryClient();
const { online } = useOnlineState();
const sheetOpen = searchParams.get("action") === "reserve";

useEffect(() => {
  if (!sheetOpen || !online) return;
  qc.invalidateQueries({ queryKey: ["reservations"] });
}, [sheetOpen, online, qc]);
```

- [ ] **Step 2: Manual verification**

Open calendar, click `Reserveer` to open the sheet. Network tab should show a `GET /api/reservations` even if the list was already loaded. Toggle offline and reopen the sheet — no new request, existing conflict warning still works against cached data.

- [ ] **Step 3: Commit**

```bash
git add app/calendar/page.tsx
git commit -m "feat(offline): refetch reservations on new-reservation sheet open"
```

---

### Task 11: End-to-end manual QA

**Files:** none — this is verification.

- [ ] **Step 1: Cold-start prewarm verification**

```bash
npm run build && npm run start
```

In Chrome incognito:
1. Visit `http://localhost:3000`, log in
2. Network tab → filter `/api/`
3. Within 2s of dashboard load: GETs to `/api/me`, `/api/dashboard`, `/api/trips`, `/api/fuel`, `/api/expenses`, `/api/reservations`, `/api/people`, `/api/cars` should all appear
4. DevTools → Application → Cache Storage → `api-data` should contain entries for all of the above

- [ ] **Step 2: Offline browsing verification**

Same session, after step 1:
1. DevTools → Application → Service Workers → tick **Offline**
2. Click each bottom-tab: dashboard, trips, fuel, calendar, expenses → all render
3. Click an existing trip → edit sheet opens with full data
4. Click an existing fuel-up → edit sheet opens
5. Click an expense → sheet opens
6. Click a calendar reservation → edit sheet opens
7. Header shows `OFFLINE` (grey, not amber, since cache is fresh)

- [ ] **Step 3: Stale-cache verification**

To force the `OFFLINE · ouder dan 1u` state without waiting an hour, in DevTools console:
```js
// Bypass: temporarily lower the threshold by hot-replacing the constant in dev tools, or
// simulate by visiting in an incognito window with a stored old `lastSyncAt` in React DevTools.
```
Practical alternative: temporarily change `STALE_THRESHOLD_MS` to `60_000` (1 min), wait 90s while offline, confirm amber appears, then revert.

- [ ] **Step 4: Form refetch verification**

Online: open Add Trip form → see `GET /api/cars/X/last-state` in network. Close form, change one byte in the seed data via direct DB edit. Re-open form → updated value shown.

- [ ] **Step 5: Heartbeat verification**

Online, open the page. Every 30s a `HEAD /api/health` request should appear. Take the network down at the OS level (not just DevTools) — within 30s the heartbeat fails and the badge transitions to OFFLINE without needing the browser's `offline` event.

- [ ] **Step 6: Note any regressions in TodoWrite and address them before PR**

---

### Task 12: Open the PR

**Files:** none — this is the workflow handoff.

- [ ] **Step 1: Run the full test suite once more**

```bash
npm test
```
Expected: all green.

- [ ] **Step 2: Push and PR**

```bash
git push -u origin feature/offline-phase-1
gh pr create --title "feat(offline): Phase 1 — read-only offline browsing" --body "$(cat <<'EOF'
## Summary
- Switches data API caching from NetworkFirst to StaleWhileRevalidate
- Boot-time parallel prewarm of all critical endpoints after auth
- Header badge with fresh/stale offline states + heartbeat-validated online detection
- Form-open refetch for trip and reservation forms (start_km / conflict freshness)

Closes #8.

## Test plan
- [ ] First visit + login: all critical endpoints appear in Network within 2s
- [ ] Toggle DevTools offline → all list pages still render with data
- [ ] Toggle DevTools offline → detail/edit sheets open correctly
- [ ] Header badge appears when offline, disappears when online
- [ ] Stale state (amber) shows when cache age > 1h
- [ ] Heartbeat detects captive-portal-style failures within 30s
- [ ] All 41+ existing tests still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Review and merge**

After self-review, merge to main. Trigger Docker build. Pull on VPS:
```bash
ssh root@100.86.173.115 "cd /opt/dockge/stacks/autodelen && docker compose pull && docker compose up -d"
```

---

## Self-review checklist (run after writing the plan)

- [x] **Spec coverage:** Every Phase-1 acceptance criterion in issue #8 maps to a task (prewarm → 5/6, indicator → 7/8, details fix → 4, write-path freshness → 9/10, online indicator → 7/8).
- [x] **No placeholders:** Every step has either real code, an exact command, or an explicit local-discovery instruction with the grep needed.
- [x] **Type consistency:** `OnlineState`, `Staleness`, `CriticalEndpoint`, `Fetcher` declared once in their owning files and referenced consistently.
- [x] **Test environment:** vitest's default `node` env handles every test in this plan; no jsdom-only assertions are made (component tests are deferred to manual QA, which is acknowledged).
- [x] **Idempotency of tasks:** every task either creates new files or makes additive changes; no task depends on uncommitted state from another.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `runtimeCaching` config syntax differs from `@ducanh2912/next-pwa` v10 | Medium | Task 4 Step 2 verifies SW regenerates and contains `StaleWhileRevalidate`. If syntax wrong, fix before merging. |
| RSC payload for detail sheets isn't covered by `/api/*` rule | Medium | Task 11 Step 2 explicitly tests detail-sheet offline behavior. If broken, add a route for `?_rsc=` pattern in next.config. |
| Heartbeat creates noise in production logs | Low | `/api/health` is intentionally tiny; can be filtered in log aggregator if needed. 30s × users is small at this scale. |
| `useBootPrewarm` runs before SW activates on first visit | Low | First prewarm goes to network anyway; subsequent ones use SW cache. Acceptable. |
| Stale threshold of 1h is wrong for the user base | Low | One-line constant; tweak after observation. |
