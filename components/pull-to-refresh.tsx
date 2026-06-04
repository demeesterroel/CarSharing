"use client";

// Pull-to-refresh for the INSTALLED PWA.
//
// When the app runs in standalone display mode there's no browser chrome, so
// the user has no native pull-to-refresh and no Ctrl+R to pick up a freshly
// deployed version. This component adds a pull-down-at-the-top gesture that
// performs a *hard* refresh: it asks the Service Worker to update (and activate
// any waiting worker) before reloading, so a new build is actually fetched —
// equivalent to Ctrl+Shift+R.
//
// Visual behaviour:
//   • Content ([data-ptr-content]) translates down with the finger (1:1 up to
//     the threshold, damped above) for an elastic/rubber-band feel.
//   • The spinner grows and rotates with pull progress; it spins continuously
//     once the threshold is passed and the refresh is running.
//   • Release before threshold → eased snap-back, no reload.
//   • Release past threshold → content settles to a small loading offset while
//     the hard refresh runs.
//
// In a normal browser tab this renders null and attaches no listeners, so the
// native gesture is left completely untouched.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useOnlineState } from "@/lib/offline/online-state";
import { useT } from "@/components/locale-provider";
import {
  decideRefresh,
  isStandalone,
  pullOffset,
  contentOffset,
  PULL_THRESHOLD_PX,
  PULL_MAX_PX,
  CONTENT_LOADING_PX,
} from "@/lib/pwa/pull-to-refresh-logic";

// Ignore horizontal-ish swipes so we don't hijack carousels / back gestures.
const HORIZONTAL_TOLERANCE = 1.2;

// CSS transition applied to content on release (snap-back or settle).
const SNAP_TRANSITION = "transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/**
 * Returns the [data-ptr-content] element that should follow the finger.
 * This is the main page wrapper div in app/layout.tsx.
 */
function getContentEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>("[data-ptr-content]");
}

/**
 * Imperatively set / clear the content translateY.
 * `animated` controls whether a CSS transition is applied (true = release/snap).
 */
function setContentTranslate(px: number, animated: boolean): void {
  const el = getContentEl();
  if (!el) return;
  el.style.transition = animated ? SNAP_TRANSITION : "none";
  el.style.transform = px === 0 ? "" : `translateY(${px}px)`;
}

/**
 * Ask the active Service Worker to update, activate any waiting worker, then
 * reload. Resilient to having no SW at all (plain reload).
 */
async function hardRefresh(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Pull the newest SW from the network.
        await reg.update().catch(() => {});
        const waiting = reg.waiting;
        if (waiting) {
          // next-pwa's runtime handles SKIP_WAITING; also post a generic skip.
          try {
            waiting.postMessage({ type: "SKIP_WAITING" });
          } catch {
            /* ignore */
          }
          // Give the new worker a moment to take control before reloading.
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
            setTimeout(done, 800);
          });
        }
      }
    }
  } catch {
    /* fall through to reload */
  }
  // Reload from the (now-updated) SW / network.
  window.location.reload();
}

export default function PullToRefresh() {
  const { online, pendingCount } = useOnlineState();
  const t = useT();

  const [enabled, setEnabled] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Latest values mirrored into refs so the (stable) event handlers can read
  // them without being re-bound on every render. Synced in an effect because
  // writing refs during render is disallowed by the React compiler.
  const stateRef = useRef({ online, pendingCount });
  const offsetRef = useRef(offset);
  const refreshingRef = useRef(refreshing);
  useEffect(() => {
    stateRef.current = { online, pendingCount };
    offsetRef.current = offset;
    refreshingRef.current = refreshing;
  });

  // Decide once on mount whether we're an installed PWA. In a browser tab this
  // stays false and we never attach listeners → complete no-op.
  useEffect(() => {
    setEnabled(isStandalone());
  }, []);

  // Cleanup: ensure content translate is cleared when component unmounts.
  useEffect(() => {
    return () => {
      setContentTranslate(0, false);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let triggered = false;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (!atTop()) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      triggered = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      // Only react to downward, mostly-vertical drags that begin at the top.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * HORIZONTAL_TOLERANCE) {
        if (offsetRef.current !== 0) {
          setOffset(0);
          setContentTranslate(0, true);
        }
        return;
      }
      if (!atTop()) {
        tracking = false;
        setOffset(0);
        setContentTranslate(0, true);
        return;
      }
      triggered = true;
      const indicatorPx = pullOffset(dy);
      const contentPx = contentOffset(dy);
      setOffset(indicatorPx);
      // Live drag: no transition — content follows finger in real time.
      setContentTranslate(contentPx, false);
      // Prevent the browser/document from also scrolling/over-scrolling.
      if (e.cancelable) e.preventDefault();
    };

    const endDrag = () => {
      if (!tracking) return;
      tracking = false;
      const dragged = offsetRef.current;
      setOffset(0);
      if (!triggered) return;

      const decision = decideRefresh({
        dragDistance: dragged,
        threshold: PULL_THRESHOLD_PX,
        online: stateRef.current.online,
        outboxCount: stateRef.current.pendingCount,
      });

      if (decision.action === "blocked-offline") {
        // Snap content back, then warn.
        setContentTranslate(0, true);
        toast.error(t("pwa.refresh_blocked_offline"));
        return;
      }

      if (decision.action === "cancel") {
        // Released before threshold — smooth snap-back to zero.
        setContentTranslate(0, true);
        return;
      }

      // decision.action === "refresh": settle content to loading offset, then reload.
      setContentTranslate(CONTENT_LOADING_PX, true);
      setRefreshing(true);
      refreshingRef.current = true;
      toast.loading(t("pwa.refreshing"));
      hardRefresh();
    };

    // passive:false on move so preventDefault works.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", endDrag, { passive: true });
    window.addEventListener("touchcancel", endDrag, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
    };
    // offset/refreshing/state are read via refs to keep handlers stable.
  }, [enabled, t]);

  if (!enabled) return null;

  const progress = Math.min(offset / PULL_THRESHOLD_PX, 1);
  const visible = offset > 0 || refreshing;
  const ready = offset >= PULL_THRESHOLD_PX;

  // Spinner grows from 0.4→1 as the user pulls, snapping to full size at threshold.
  const spinnerScale = refreshing ? 1 : 0.4 + progress * 0.6;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 1000,
        transform: `translateY(${(refreshing ? PULL_THRESHOLD_PX : offset) - PULL_MAX_PX}px)`,
        // Snap indicator back on release; no transition during live drag.
        transition: offset === 0 && !refreshing ? "transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        role="status"
        style={{
          marginTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--paper)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Scale the bubble in as the user pulls.
          transform: `scale(${spinnerScale})`,
          transition: refreshing ? "none" : "transform 0.1s linear",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "2px solid var(--ink-mute)",
            borderTopColor: ready || refreshing ? "var(--accent)" : "var(--ink-mute)",
            // Spin while refreshing; otherwise rotate proportionally to the pull.
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
            animation: refreshing ? "ptr-spin 0.7s linear infinite" : undefined,
          }}
        />
      </div>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
