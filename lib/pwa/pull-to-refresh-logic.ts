// Pure, framework-free logic for the PWA pull-to-refresh gesture.
// Kept separate from the React component so it can be unit-tested without
// needing real touch events / a DOM.

export const PULL_THRESHOLD_PX = 70;
// How much the indicator resists the drag past the threshold (rubber-banding).
export const PULL_RESISTANCE = 0.5;
// Maximum visual travel of the indicator regardless of how far the user drags.
export const PULL_MAX_PX = 120;

/**
 * Detects whether the app is running as an installed PWA (standalone display
 * mode). In a normal browser tab this returns false so the gesture is a no-op.
 */
export function isStandalone(win: Window = window): boolean {
  try {
    const mql = win.matchMedia?.("(display-mode: standalone)");
    if (mql?.matches) return true;
  } catch {
    /* matchMedia may be unavailable */
  }
  // iOS Safari exposes navigator.standalone instead of display-mode.
  return (win.navigator as unknown as { standalone?: boolean })?.standalone === true;
}

/**
 * Translates a raw vertical drag distance (px the finger has moved down) into
 * the indicator's visual offset, applying rubber-band resistance past the
 * threshold and clamping to a maximum.
 */
export function pullOffset(rawDelta: number): number {
  if (rawDelta <= 0) return 0;
  if (rawDelta <= PULL_THRESHOLD_PX) return rawDelta;
  const extra = (rawDelta - PULL_THRESHOLD_PX) * PULL_RESISTANCE;
  return Math.min(PULL_THRESHOLD_PX + extra, PULL_MAX_PX);
}

export interface RefreshDecisionInput {
  /** Vertical px the finger moved down (>= 0). */
  dragDistance: number;
  /** Trigger threshold in px. */
  threshold: number;
  /** Whether the app currently has connectivity. */
  online: boolean;
  /** Number of mutations still waiting in the offline outbox. */
  outboxCount: number;
}

export type RefreshDecision =
  | { action: "refresh" }
  | { action: "cancel" } // released before threshold
  | { action: "blocked-offline" }; // would lose unsynced offline data

/**
 * Decides what should happen when the user releases a pull-to-refresh drag.
 *
 * - Below threshold -> "cancel" (snap back, do nothing).
 * - Past threshold but OFFLINE with queued mutations -> "blocked-offline".
 *   A hard reload while offline could strand the user on a stale/empty cache
 *   and is pointless (no new version to fetch), so we refuse and warn instead.
 *   The outbox itself is IndexedDB-backed and survives reloads, but blocking is
 *   the safest, clearest UX.
 * - Otherwise -> "refresh".
 */
export function decideRefresh(input: RefreshDecisionInput): RefreshDecision {
  if (input.dragDistance < input.threshold) return { action: "cancel" };
  if (!input.online && input.outboxCount > 0) return { action: "blocked-offline" };
  return { action: "refresh" };
}
