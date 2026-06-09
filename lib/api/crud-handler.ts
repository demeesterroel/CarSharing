/**
 * Generic CRUD handler factories for Next.js App Router API routes.
 *
 * Each factory returns a Next.js route handler wrapped in the standard
 * json() error-handling wrapper. Use these to eliminate repeated boilerplate
 * in simple CRUD routes.
 *
 * Authorization: the mutating factories (create/update/delete) REQUIRE an
 * `authorize` callback so a route can never be exposed by accident — the
 * payments routes were previously created with no auth check at all because
 * these factories silently allowed it. The callback receives the request and
 * must throw (e.g. via `requireAdmin` / `forbidden`) when the caller is not
 * permitted. Read factories take an optional `authorize` for the same reason.
 *
 * For routes with custom logic (e.g. status patches, auth flows, computed
 * fields that require fetching the existing row before updating), write a
 * plain handler using json() / readBody() / readId() directly.
 */

import { json, notFound, readBody, readId, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import type Database from "better-sqlite3";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

type Ctx = { params: Promise<Record<string, string>> };

/**
 * Authorization guard run before a handler executes. Must throw an HttpError
 * (e.g. via `requireAdmin` or `forbidden()`) to reject the request; the return
 * value is ignored.
 */
export type Authorize = (req: Request) => Promise<unknown> | unknown;

// ---------------------------------------------------------------------------
// Collection handlers  (app/api/<resource>/route.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a GET handler that calls `list(db)` and returns the result as JSON.
 * Pass `authorize` to restrict who may read the collection.
 */
export function listHandler<T>(list: (db: Database.Database) => T[], authorize?: Authorize) {
  return json(async (req: Request) => {
    await (authorize ?? requireSession)(req);
    return list(getDb());
  });
}

/**
 * Returns a POST handler that validates the request body against `schema`,
 * calls `insert(db, data)`, and returns `{ id }` with HTTP 201.
 * `authorize` is required and runs before the body is read.
 */
export function createHandler<T>(
  schema: ZodSchema<T>,
  insert: (db: Database.Database, data: T) => number,
  authorize: Authorize
) {
  return json(async (req: Request) => {
    await authorize(req);
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
 * Pass `authorize` to restrict who may read the record.
 */
export function getOneHandler<T>(
  getById: (db: Database.Database, id: number) => T | null | undefined,
  authorize?: Authorize
) {
  return json(async (req: Request, ctx: Ctx) => {
    await (authorize ?? requireSession)(req);
    const row = getById(getDb(), await readId(ctx));
    if (!row) notFound();
    return row;
  });
}

/**
 * Returns a PUT handler that validates the request body against `schema`
 * and calls `update(db, id, data)`. Returns `{ ok: true }` on success.
 * `authorize` is required and runs before the body is read.
 */
export function updateHandler<T>(
  schema: ZodSchema<T>,
  update: (db: Database.Database, id: number, data: T) => void,
  authorize: Authorize
) {
  return json(async (req: Request, ctx: Ctx) => {
    await authorize(req);
    const id = await readId(ctx);
    const data = await readBody(req, schema);
    update(getDb(), id, data);
    return { ok: true };
  });
}

/**
 * Returns a DELETE handler that calls `del(db, id)`.
 * Returns `{ ok: true }` on success.
 * `authorize` is required and runs before the record is deleted.
 */
export function deleteHandler(
  del: (db: Database.Database, id: number) => void,
  authorize: Authorize
) {
  return json(async (req: Request, ctx: Ctx) => {
    await authorize(req);
    del(getDb(), await readId(ctx));
    return { ok: true };
  });
}
