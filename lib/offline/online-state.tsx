"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const HEARTBEAT_TIMEOUT_MS = 5 * 1000;
const STALENESS_TICK_MS = 60 * 1000;

export type Staleness = "fresh" | "stale" | "unknown";

export function computeStaleness(lastSyncAt: number | null, now: number): Staleness {
  if (lastSyncAt === null) return "unknown";
  return now - lastSyncAt <= STALE_THRESHOLD_MS ? "fresh" : "stale";
}

export interface OnlineState {
  online: boolean;
  lastSyncAt: number | null;
  staleness: Staleness;
  pendingCount: number;
  markSynced: () => void;
  setPendingCount: (n: number) => void;
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
    const res = await fetch("/api/health", {
      method: "HEAD",
      signal: ctrl.signal,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function OnlineStateProvider({ children }: { children: React.ReactNode }) {
  // Initialize to true to match SSR output; useEffect syncs actual navigator.onLine on client.
  // Avoids hydration mismatch when browser has navigator.onLine = false at mount time.
  const [online, setOnline] = useState<boolean>(true);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pendingCount, setPendingCount] = useState(0);
  const heartbeatRunningRef = useRef(false);

  const markSynced = useCallback(() => setLastSyncAt(Date.now()), []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  // Periodic heartbeat — corrects for captive portals where navigator.onLine is true
  // but the network is unreachable.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (heartbeatRunningRef.current) return;
      heartbeatRunningRef.current = true;
      try {
        const ok = await heartbeat();
        if (!cancelled && !ok) setOnline(false);
      } finally {
        heartbeatRunningRef.current = false;
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);

  // Recovery heartbeat — runs when offline to detect network return even when
  // the browser doesn't fire the 'online' event (e.g. DevTools SW offline checkbox).
  useEffect(() => {
    if (online) return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (heartbeatRunningRef.current) return;
      heartbeatRunningRef.current = true;
      try {
        const ok = await heartbeat();
        if (!cancelled && ok) setOnline(true);
      } finally {
        heartbeatRunningRef.current = false;
      }
    }, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);

  // Tick `now` once a minute so staleness recomputes without remounts.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STALENESS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const value: OnlineState = {
    online,
    lastSyncAt,
    staleness: computeStaleness(lastSyncAt, now),
    pendingCount,
    markSynced,
    setPendingCount,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
