import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, type ZodSchema } from "zod";
import { validateCsrfToken } from "./csrf";
import { checkRateLimit } from "./rate-limit";
import type { SessionData } from "./session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Throws an HttpError with status 404. */
export function notFound(msg = "Not found"): never {
  throw new HttpError(404, msg);
}

/** Throws an HttpError with status 400. */
export function badRequest(msg = "Bad request"): never {
  throw new HttpError(400, msg);
}

/** Throws an HttpError with status 403. */
export function forbidden(msg = "Forbidden"): never {
  throw new HttpError(403, msg);
}

/** Throws an HttpError with status 409. */
export function conflict(msg = "Conflict"): never {
  throw new HttpError(409, msg);
}

/** Reads the session from the request and throws 403 if the user is not an admin. */
export async function requireAdmin(req: Request) {
  const { getIronSession } = await import("iron-session");
  const { sessionOptions } = await import("./session");
  const session = await getIronSession<SessionData>(req, NextResponse.next(), sessionOptions);
  if (!session.isAdmin) forbidden();
  return session;
}

/** Throws 403 if the session user is neither admin nor an owner. Returns session. */
export async function requireAdminOrOwner(req: Request) {
  const { getIronSession } = await import("iron-session");
  const { sessionOptions } = await import("./session");
  const session = await getIronSession<SessionData>(req, NextResponse.next(), sessionOptions);
  if (session.isAdmin) return session;
  const name = session.personName;
  if (!name) forbidden();
  // isOwner is not stored in the session — check DB at runtime
  const { getDb } = await import("./db");
  const { isOwner } = await import("./queries/people");
  if (!isOwner(getDb(), name)) forbidden();
  return session;
}

type Handler<T> = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<T> | T;

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/** Wraps a route handler with rate limiting, CSRF validation, and JSON response formatting. */
export function json<T>(handler: Handler<T>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const pathname = new URL(req.url).pathname;
    const isLogin = pathname === "/api/auth/login";
    const rl = checkRateLimit(
      `${ip}:${pathname}`,
      isLogin ? { max: 5, windowMs: 15 * 60 * 1000 } : { max: 120, windowMs: 60 * 1000 }
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
    try {
      if (MUTATING_METHODS.includes(req.method ?? "")) {
        if (!validateCsrfToken(req as NextRequest)) {
          return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
        }
      }
      const result = await handler(req, ctx);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 }
        );
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

/**
 * Parses and validates the JSON request body against a Zod schema.
 * @param req - Incoming request.
 * @param schema - Zod schema to validate against.
 * @returns Parsed and validated body.
 */
export async function readBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const raw = await req.json().catch(() => badRequest("Invalid JSON"));
  return schema.parse(raw);
}

/**
 * Resolves and validates the `id` route parameter as a positive integer.
 * @param ctx - Route context containing the awaitable params.
 * @returns Numeric id.
 */
export async function readId(ctx: { params: Promise<Record<string, string>> }): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) badRequest(`Invalid id: ${id}`);
  return n;
}
