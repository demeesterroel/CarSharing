# CarSharing — Plan 00: Shared API & Hook Helpers

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisite:** plans 01, 02, 03 completed.

**Goal:** Centralize the two patterns that repeat across every CRUD surface: API-route error handling + Zod body validation, and the TanStack Query CRUD hook boilerplate.

**Architecture:** One `lib/api.ts` helper wraps every route handler. One `hooks/use-resource.ts` factory produces `useX / useCreateX / useUpdateX / useDeleteX` from a single call. Later plans (05–09) reference these instead of duplicating the patterns.

**Tech Stack:** Next.js Route Handlers, Zod, TanStack Query.

---

### Task 1: API handler wrapper

**Files:**
- Create: `lib/api.ts`
- Create: `lib/__tests__/api.test.ts`

- [ ] **Step 1: Create lib/api.ts**

```ts
import { NextResponse } from "next/server";
import { z, ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFound(msg = "Not found"): never {
  throw new HttpError(404, msg);
}

export function badRequest(msg = "Bad request"): never {
  throw new HttpError(400, msg);
}

type Handler<T> = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<T> | T;

export function json<T>(handler: Handler<T>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export async function readBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const raw = await req.json().catch(() => badRequest("Invalid JSON"));
  return schema.parse(raw);
}

export async function readId(ctx: { params: Promise<{ id: string }> }): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) badRequest(`Invalid id: ${id}`);
  return n;
}
```

- [ ] **Step 2: Write failing test**

Create `lib/__tests__/api.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { json, readBody, badRequest, HttpError } from "../api";

describe("json wrapper", () => {
  it("returns data as JSON on success", async () => {
    const handler = json(async () => ({ ok: true }));
    const res = await handler(new Request("http://x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps HttpError to matching status", async () => {
    const handler = json(async () => { throw new HttpError(404, "gone"); });
    const res = await handler(new Request("http://x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "gone" });
  });

  it("maps ZodError to 400 with issues", async () => {
    const schema = z.object({ n: z.number() });
    const handler = json(async (req) => {
      const body = await readBody(req, schema);
      return body;
    });
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ n: "not-a-number" }), headers: { "Content-Type": "application/json" } });
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npm test lib/__tests__/api.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/api.ts lib/__tests__/api.test.ts
git commit -m "feat: json/readBody/readId api helpers with tests"
```

---

### Task 2: TanStack Query CRUD hook factory

**Files:**
- Create: `hooks/use-resource.ts`

- [ ] **Step 1: Create hooks/use-resource.ts**

```ts
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

interface Factory<T extends { id: number }, TInput> {
  useList: () => ReturnType<typeof useQuery<T[]>>;
  useCreate: () => ReturnType<typeof useMutation<{ id: number }, Error, TInput>>;
  useUpdate: () => ReturnType<typeof useMutation<unknown, Error, TInput & { id: number }>>;
  useDelete: () => ReturnType<typeof useMutation<unknown, Error, number>>;
}

export function createResourceHooks<T extends { id: number }, TInput>(
  key: string,
  path: string,
  opts?: { invalidate?: QueryKey[] }
): Factory<T, TInput> {
  const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: [key] });
    for (const k of opts?.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
  };

  return {
    useList: () =>
      useQuery<T[]>({ queryKey: [key], queryFn: () => send<T[]>(path) }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation<{ id: number }, Error, TInput>({
        mutationFn: (data) => send(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        onSuccess: () => invalidate(qc),
      });
    },

    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation<unknown, Error, TInput & { id: number }>({
        mutationFn: ({ id, ...data }) => send(`${path}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        onSuccess: () => invalidate(qc),
      });
    },

    useDelete: () => {
      const qc = useQueryClient();
      return useMutation<unknown, Error, number>({
        mutationFn: (id) => send(`${path}/${id}`, { method: "DELETE" }),
        onSuccess: () => invalidate(qc),
      });
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-resource.ts
git commit -m "feat: createResourceHooks factory for CRUD hooks"
```

---

### Task 3: Update hook files from plans 05–09

The plans that follow all import from this module. For reference, a full resource's hooks now look like:

```ts
// hooks/use-trips.ts
import { createResourceHooks } from "./use-resource";
import type { Trip, TripInput } from "@/types";

export const tripsHooks = createResourceHooks<Trip, TripInput>("trips", "/api/trips", {
  invalidate: [["dashboard"]],
});
export const useTrips = tripsHooks.useList;
export const useCreateTrip = tripsHooks.useCreate;
export const useUpdateTrip = tripsHooks.useUpdate;
export const useDeleteTrip = tripsHooks.useDelete;
```

Apply the same pattern to `hooks/use-people.ts`, `hooks/use-cars.ts`, `hooks/use-fuel-fillups.ts`, `hooks/use-expenses.ts`, `hooks/use-payments.ts`, `hooks/use-reservations.ts`. All six drop from ~30 lines to ~6. `people` and `cars` don't need dashboard invalidation; the others do.
