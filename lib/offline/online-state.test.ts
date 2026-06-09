import { describe, expect, it } from "vitest";
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
