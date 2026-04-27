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
      url.includes("trips")
        ? Promise.reject(new Error("boom"))
        : Promise.resolve([])
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

  it("returns one settled result per endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({});
    const qc = new QueryClient();
    const results = await prewarmCriticalEndpoints(qc, fetcher);
    expect(results).toHaveLength(CRITICAL_ENDPOINTS.length);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
