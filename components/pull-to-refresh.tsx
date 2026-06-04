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

// A single cog (Material "settings" gear) for the gear-powered indicator.
const GEAR_PATH =
  "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z";

/** One rotating cog. Rotates proportionally to the pull, or spins while refreshing. */
function Gear({
  px,
  x,
  y,
  color,
  rotateDeg,
  spin,
  durationSec,
  reverse,
}: {
  px: number;
  x: number;
  y: number;
  color: string;
  rotateDeg: number;
  spin: boolean;
  durationSec: number;
  reverse: boolean;
}) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        fill: color,
        transformOrigin: "center",
        transform: spin ? undefined : `rotate(${rotateDeg}deg)`,
        animation: spin
          ? `${reverse ? "ptr-gear-rev" : "ptr-gear"} ${durationSec}s linear infinite`
          : undefined,
        transition: spin ? "none" : "transform 0.06s linear, fill 0.15s ease",
      }}
    >
      <path d={GEAR_PATH} />
    </svg>
  );
}

/**
 * Returns the [data-ptr-content] element that should follow the finger.
 * This is the main page wrapper div in app/layout.tsx.
 */
function getContentEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>("[data-ptr-content]");
}

/** The sticky page header(s) — kept visually fixed while the content pulls. */
function getHeaderEls(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>(".page-header-border"));
}

/**
 * Imperatively set / clear the content translateY, and counter-translate the
 * sticky header by the opposite amount so it stays fixed while the content
 * below it pulls down (the indicator is revealed from under the header).
 * `animated` controls whether a CSS transition is applied (true = release/snap).
 */
function setContentTranslate(px: number, animated: boolean): void {
  const el = getContentEl();
  if (el) {
    el.style.transition = animated ? SNAP_TRANSITION : "none";
    el.style.transform = px === 0 ? "" : `translateY(${px}px)`;
  }
  for (const h of getHeaderEls()) {
    h.style.transition = animated ? SNAP_TRANSITION : "none";
    // Cancel the content's downward shift so the header appears pinned.
    h.style.transform = px === 0 ? "" : `translateY(${-px}px)`;
  }
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
        // Behind the sticky header (z-index 20) so the indicator is revealed
        // from *under* the fixed header as the content pulls down.
        zIndex: 10,
        transform: `translateY(${(refreshing ? PULL_THRESHOLD_PX : offset) - PULL_MAX_PX}px)`,
        // Snap indicator back on release; no transition during live drag.
        transition: offset === 0 && !refreshing ? SNAP_TRANSITION : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        role="status"
        style={{
          marginTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "var(--paper)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Scale the bubble in as the user pulls.
          transform: `scale(${spinnerScale})`,
          transition: refreshing ? "none" : "transform 0.12s ease-out",
        }}
      >
        {/* Two meshing gears — turn with the pull, spin (opposite ways) on refresh */}
        <div style={{ position: "relative", width: 30, height: 28 }}>
          <Gear
            px={22}
            x={0}
            y={1}
            color={ready || refreshing ? "var(--accent)" : "var(--ink-mute)"}
            rotateDeg={progress * 200}
            spin={refreshing}
            durationSec={1.1}
            reverse={false}
          />
          <Gear
            px={15}
            x={16}
            y={12}
            color="var(--ink-mute)"
            rotateDeg={-progress * 330}
            spin={refreshing}
            durationSec={0.7}
            reverse
          />
        </div>
      </div>
      <style>{`
        @keyframes ptr-gear { to { transform: rotate(360deg); } }
        @keyframes ptr-gear-rev { to { transform: rotate(-360deg); } }
      `}</style>
    </div>
  );
}
