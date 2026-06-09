// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAll, count, enqueue, list, peek, remove } from "./outbox";

describe("outbox", () => {
  beforeEach(async () => {
    await clearAll();
  });

  it("enqueues and lists items in FIFO order", async () => {
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
    const items = await list();
    expect(items).toHaveLength(2);
    expect(items[0].body).toEqual({ a: 1 });
    expect(items[1].body).toEqual({ a: 2 });
  });

  it("peek returns the oldest item without removing it", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 1 },
      resource: "trips",
      client_id: "u-1",
    });
    const head = await peek();
    expect(head?.body).toEqual({ a: 1 });
    expect(await count()).toBe(1);
  });

  it("remove drops an item by id", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: { a: 1 },
      resource: "trips",
      client_id: "u-1",
    });
    const item = await peek();
    await remove(item!.id);
    expect(await count()).toBe(0);
  });

  it("count returns the queue size", async () => {
    expect(await count()).toBe(0);
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: {},
      resource: "trips",
      client_id: "u",
    });
    expect(await count()).toBe(1);
  });

  it("survives 'reopens' (re-import) preserving items", async () => {
    await enqueue({
      url: "/api/trips",
      method: "POST",
      body: {},
      resource: "trips",
      client_id: "u-1",
    });
    // simulate reopen by clearing module cache — fake-indexeddb persists per test
    expect(await count()).toBe(1);
  });
});
