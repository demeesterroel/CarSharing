import { describe, it, expect } from "vitest";
import {
  decideRefresh,
  pullOffset,
  isStandalone,
  PULL_THRESHOLD_PX,
  PULL_MAX_PX,
} from "./pull-to-refresh-logic";

describe("decideRefresh", () => {
  const base = { threshold: PULL_THRESHOLD_PX, online: true, outboxCount: 0 };

  it("cancels when released before the threshold", () => {
    expect(decideRefresh({ ...base, dragDistance: PULL_THRESHOLD_PX - 1 })).toEqual({
      action: "cancel",
    });
  });

  it("refreshes when past threshold and online", () => {
    expect(decideRefresh({ ...base, dragDistance: PULL_THRESHOLD_PX })).toEqual({
      action: "refresh",
    });
    expect(decideRefresh({ ...base, dragDistance: PULL_THRESHOLD_PX + 50 })).toEqual({
      action: "refresh",
    });
  });

  it("refreshes when online even with a non-empty outbox (outbox is persisted)", () => {
    expect(
      decideRefresh({ ...base, dragDistance: PULL_THRESHOLD_PX + 10, outboxCount: 3 })
    ).toEqual({ action: "refresh" });
  });

  it("refreshes when offline but the outbox is empty", () => {
    expect(
      decideRefresh({
        ...base,
        dragDistance: PULL_THRESHOLD_PX + 10,
        online: false,
        outboxCount: 0,
      })
    ).toEqual({ action: "refresh" });
  });

  it("blocks when offline with unsynced mutations to avoid stranding data", () => {
    expect(
      decideRefresh({
        ...base,
        dragDistance: PULL_THRESHOLD_PX + 10,
        online: false,
        outboxCount: 2,
      })
    ).toEqual({ action: "blocked-offline" });
  });

  it("prioritises the cancel decision below threshold even when offline with a queue", () => {
    expect(decideRefresh({ ...base, dragDistance: 5, online: false, outboxCount: 2 })).toEqual({
      action: "cancel",
    });
  });
});

describe("pullOffset", () => {
  it("returns 0 for non-positive deltas", () => {
    expect(pullOffset(0)).toBe(0);
    expect(pullOffset(-20)).toBe(0);
  });

  it("tracks 1:1 below the threshold", () => {
    expect(pullOffset(40)).toBe(40);
    expect(pullOffset(PULL_THRESHOLD_PX)).toBe(PULL_THRESHOLD_PX);
  });

  it("applies resistance past the threshold", () => {
    // 70 + (170-70)*0.5 = 120, clamped at PULL_MAX_PX
    expect(pullOffset(PULL_THRESHOLD_PX + 20)).toBeLessThan(PULL_THRESHOLD_PX + 20);
    expect(pullOffset(PULL_THRESHOLD_PX + 20)).toBeGreaterThan(PULL_THRESHOLD_PX);
  });

  it("never exceeds the max travel", () => {
    expect(pullOffset(10_000)).toBe(PULL_MAX_PX);
  });
});

describe("isStandalone", () => {
  function fakeWin(opts: { display?: boolean; iosStandalone?: boolean }): Window {
    return {
      matchMedia: (q: string) => ({ matches: q.includes("standalone") ? !!opts.display : false }),
      navigator: { standalone: opts.iosStandalone },
    } as unknown as Window;
  }

  it("is true when display-mode is standalone", () => {
    expect(isStandalone(fakeWin({ display: true }))).toBe(true);
  });

  it("is true on iOS standalone navigator flag", () => {
    expect(isStandalone(fakeWin({ display: false, iosStandalone: true }))).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    expect(isStandalone(fakeWin({ display: false }))).toBe(false);
  });

  it("does not throw if matchMedia is missing", () => {
    expect(isStandalone({ navigator: {} } as unknown as Window)).toBe(false);
  });
});
