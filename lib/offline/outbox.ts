import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface QueuedMutation {
  id: number;
  url: string;
  method: "POST" | "PUT" | "DELETE";
  body: unknown;
  headers?: Record<string, string>;
  resource: "trips" | "fuel-fillups" | "expenses" | "reservations";
  resource_id?: number | string;
  client_id?: string;
  expectedUpdatedAt?: string;
  queued_at: number;
  attempts: number;
  last_error?: string;
}

interface OutboxDB extends DBSchema {
  mutations: {
    key: number;
    value: QueuedMutation;
    indexes: { "by-queued_at": number };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>("autodelen-outbox", 1, {
      upgrade(d) {
        const store = d.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        store.createIndex("by-queued_at", "queued_at");
      },
    });
  }
  return dbPromise;
}

export async function enqueue(
  item: Omit<QueuedMutation, "id" | "queued_at" | "attempts">
): Promise<number> {
  const d = await db();
  const id = await d.add("mutations", {
    ...item,
    queued_at: Date.now(),
    attempts: 0,
  } as QueuedMutation);
  return id as number;
}

export async function peek(): Promise<QueuedMutation | undefined> {
  const d = await db();
  const all = await d.getAllFromIndex("mutations", "by-queued_at");
  return all[0];
}

export async function list(): Promise<QueuedMutation[]> {
  const d = await db();
  return d.getAllFromIndex("mutations", "by-queued_at");
}

export async function remove(id: number): Promise<void> {
  const d = await db();
  await d.delete("mutations", id);
}

export async function update(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  const d = await db();
  const cur = await d.get("mutations", id);
  if (!cur) return;
  await d.put("mutations", { ...cur, ...patch });
}

export async function count(): Promise<number> {
  const d = await db();
  return d.count("mutations");
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear("mutations");
  // Reset the db promise so next call re-opens (needed for test isolation with fake-indexeddb)
  dbPromise = null;
}
