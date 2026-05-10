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
  { queryKey: ["trips"], url: "/api/trips" },
  { queryKey: ["fuel-fillups"], url: "/api/fuel" },
  { queryKey: ["expenses"], url: "/api/expenses" },
  { queryKey: ["reservations"], url: "/api/reservations" },
  { queryKey: ["people"], url: "/api/people" },
  { queryKey: ["cars"], url: "/api/vehicles" },
] as const;

// Pages whose RSC payloads are pre-fetched so the SW caches them in `pages-rsc`.
// This makes every tab available offline even before the user has navigated to it.
export const CRITICAL_PAGES = ["/", "/trips", "/fuel", "/calendar", "/expenses"] as const;

export type Fetcher = (url: string) => Promise<unknown>;

async function defaultFetcher(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function prewarmCriticalEndpoints(
  qc: QueryClient,
  fetcher: Fetcher = defaultFetcher
): Promise<PromiseSettledResult<unknown>[]> {
  const tasks = CRITICAL_ENDPOINTS.map((ep) =>
    qc
      .prefetchQuery({ queryKey: ep.queryKey, queryFn: () => fetcher(ep.url) })
      .then(() => qc.getQueryData(ep.queryKey))
  );
  return Promise.allSettled(tasks);
}

// Fetches RSC payloads for every critical page so the SW caches them in `pages-rsc`.
// Must be called while online; errors are silently swallowed (non-critical for UX).
export async function prewarmPages(pageFetcher?: (url: string) => Promise<unknown>): Promise<void> {
  const fetch_ =
    pageFetcher ??
    ((url: string) =>
      fetch(url, {
        method: "GET",
        headers: { RSC: "1", "Next-Router-Prefetch": "1" },
        cache: "no-cache",
      }));
  await Promise.allSettled(CRITICAL_PAGES.map((url) => fetch_(url).catch(() => undefined)));
}

export function useBootPrewarm(authReady: boolean): void {
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
    prewarmPages();
  }, [authReady, online, qc, markSynced]);
}
