// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll, enqueue, list } from "./outbox";
import { drainOutbox } from "./sync-engine";

function makeFetcher(responses: Array<{ status: number; body?: unknown }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { status: 200, body: { ok: true } };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  });
}

describe("drainOutbox", () => {
  beforeEach(async () => {
    await clearAll();
  });

  it("drains all items on success in FIFO order", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 1 },
      resource: "trips",
      client_id: "u-1",
    });
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 2 },
      resource: "trips",
      client_id: "u-2",
    });
    const fetcher = makeFetcher([{ status: 201 }, { status: 201 }]);
    const onSuccess = vi.fn();
    const result = await drainOutbox({ fetch: fetcher, onSuccess });
    expect(result.drained).toBe(2);
    expect(await list()).toHaveLength(0);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/trips"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ a: 1 }) })
    );
  });

  it("stops draining on 5xx and leaves item in queue with incremented attempts", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 1 },
      resource: "trips",
      client_id: "u-1",
    });
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 2 },
      resource: "trips",
      client_id: "u-2",
    });
    const fetcher = makeFetcher([{ status: 500 }]);
    const result = await drainOutbox({ fetch: fetcher });
    expect(result.drained).toBe(0);
    const items = await list();
    expect(items).toHaveLength(2);
    expect(items[0].attempts).toBe(1);
  });

  it("drops an item on 409 conflict and continues", async () => {
    await enqueue({
      url: "/api/trips/5",
      method: "PUT",
      body: {},
      resource: "trips",
      resource_id: 5,
      expectedUpdatedAt: "old",
    });
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: {},
      resource: "trips",
      client_id: "u-2",
    });
    const fetcher = makeFetcher([{ status: 409 }, { status: 201 }]);
    const onConflict = vi.fn();
    const result = await drainOutbox({ fetch: fetcher, onConflict });
    expect(result.drained).toBe(1);
    expect(result.conflicts).toBe(1);
    expect(onConflict).toHaveBeenCalled();
    expect(await list()).toHaveLength(0);
  });

  it("aborts cleanly when network fails (offline mid-drain)", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: {},
      resource: "trips",
      client_id: "u",
    });
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await drainOutbox({ fetch: fetcher });
    expect(result.drained).toBe(0);
    expect((await list()).length).toBe(1);
  });
});
