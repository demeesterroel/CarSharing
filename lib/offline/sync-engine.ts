"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useOnlineState } from "./online-state";
import type { QueuedMutation } from "./outbox";
import { count, peek, remove, update } from "./outbox";

export interface DrainResult {
  drained: number;
  conflicts: number;
  failed: number;
}

export interface DrainOptions {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  onSuccess?: (item: QueuedMutation, response: unknown) => void;
  onConflict?: (item: QueuedMutation) => void;
}

let draining = false; // single-flight guard

export async function drainOutbox(opts: DrainOptions = {}): Promise<DrainResult> {
  if (draining) return { drained: 0, conflicts: 0, failed: 0 };
  draining = true;
  const fetcher = opts.fetch ?? fetch;
  let drained = 0,
    conflicts = 0,
    failed = 0;
  try {
    while (true) {
      const head = await peek();
      if (!head) break;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(head.headers ?? {}),
      };
      if (head.expectedUpdatedAt) headers["X-Expected-Updated-At"] = head.expectedUpdatedAt;

      let res: Response;
      try {
        res = await fetcher(head.url, {
          method: head.method,
          headers,
          body: head.method === "DELETE" ? undefined : JSON.stringify(head.body),
        });
      } catch {
        await update(head.id, { attempts: head.attempts + 1, last_error: "network" });
        failed++;
        break; // network failure → stop draining, will retry on next online event
      }

      if (res.status === 409) {
        await remove(head.id);
        conflicts++;
        opts.onConflict?.(head);
        continue;
      }

      if (res.status >= 500) {
        await update(head.id, { attempts: head.attempts + 1, last_error: `server-${res.status}` });
        failed++;
        break; // server error → stop, retry later
      }

      if (!res.ok) {
        // 4xx (other than 409) — likely permanent client error. Drop with conflict semantics.
        await remove(head.id);
        conflicts++;
        opts.onConflict?.(head);
        continue;
      }

      const body = await res.json().catch(() => ({}));
      await remove(head.id);
      drained++;
      opts.onSuccess?.(head, body);
    }
  } finally {
    draining = false;
  }
  return { drained, conflicts, failed };
}

export function useSyncEngine(opts?: { setPendingCount?: (n: number) => void }) {
  const qc = useQueryClient();
  const { online } = useOnlineState();
  const lastTriggerRef = useRef(0);

  // Drain on transition online and on mount if there's a queue.
  useEffect(() => {
    if (!online) return;
    const now = Date.now();
    if (now - lastTriggerRef.current < 1000) return;
    lastTriggerRef.current = now;
    drainOutbox({
      onSuccess: (item) => {
        qc.invalidateQueries({ queryKey: [item.resource] });
      },
      onConflict: (item) => {
        qc.invalidateQueries({ queryKey: [item.resource] });
        // Toast is fired from a conflict listener in providers.tsx which has i18n context.
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("offline-conflict", { detail: item }));
        }
      },
    }).then((result) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-drain-complete", { detail: result }));
      }
    });
  }, [online, qc]);

  // Poll pending count so the badge stays up to date.
  useEffect(() => {
    if (!opts?.setPendingCount) return;
    let cancelled = false;
    const setPendingCount = opts.setPendingCount;
    const tick = async () => {
      const c = await count();
      if (!cancelled) setPendingCount(c);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [opts?.setPendingCount]);

  // Register Background Sync if available (Chrome/Edge only).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if ("sync" in reg) {
        (reg as any).sync.register("autodelen-mutations").catch(() => {
          /* unsupported */
        });
      }
    });
  }, []);
}

export async function pendingCount(): Promise<number> {
  return count();
}
