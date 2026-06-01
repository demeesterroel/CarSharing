/**
 * Generic CRUD handler factories for Next.js App Router API routes.
 *
 * Each factory returns a Next.js route handler wrapped in the standard
 * json() error-handling wrapper. Use these to eliminate repeated boilerplate
 * in simple CRUD routes.
 *
 * For routes with custom logic (e.g. status patches, auth flows, computed
 * fields that require fetching the existing row before updating), write a
 * plain handler using json() / readBody() / readId() directly.
 */

import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { json, readBody, readId, notFound, requireSession } from "@/lib/api";

type Ctx = { params: Promise<Record<string, string>> };

// ---------------------------------------------------------------------------
// Collection handlers  (app/api/<resource>/route.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a GET handler that calls `list(db)` and returns the result as JSON.
 */
export function listHandler<T>(list: (db: Database.Database) => T[]) {
  return json(async (req: Request) => {
    await requireSession(req);
    return list(getDb());
  });
}

/**
 * Returns a POST handler that validates the request body against `schema`,
 * calls `insert(db, data)`, and returns `{ id }` with HTTP 201.
 */
export function createHandler<T>(
  schema: ZodSchema<T>,
  insert: (db: Database.Database, data: T) => number
) {
  return json(async (req: Request) => {
    const data = await readBody(req, schema);
    const id = insert(getDb(), data);
    return NextResponse.json({ id }, { status: 201 });
  });
}

// ---------------------------------------------------------------------------
// Item handlers  (app/api/<resource>/[id]/route.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a GET handler that fetches a single record by id.
 * Throws 404 if the query returns null/undefined.
 */
export function getOneHandler<T>(
  getById: (db: Database.Database, id: number) => T | null | undefined
) {
  return json(async (req: Request, ctx: Ctx) => {
    await requireSession(req);
    const row = getById(getDb(), await readId(ctx));
    if (!row) notFound();
    return row;
  });
}

/**
 * Returns a PUT handler that validates the request body against `schema`
 * and calls `update(db, id, data)`. Returns `{ ok: true }` on success.
 */
export function updateHandler<T>(
  schema: ZodSchema<T>,
  update: (db: Database.Database, id: number, data: T) => void
) {
  return json(async (req: Request, ctx: Ctx) => {
    const id = await readId(ctx);
    const data = await readBody(req, schema);
    update(getDb(), id, data);
    return { ok: true };
  });
}

/**
 * Returns a DELETE handler that calls `del(db, id)`.
 * Returns `{ ok: true }` on success.
 */
export function deleteHandler(del: (db: Database.Database, id: number) => void) {
  return json(async (_req: Request, ctx: Ctx) => {
    del(getDb(), await readId(ctx));
    return { ok: true };
  });
}
