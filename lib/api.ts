import { NextResponse } from "next/server";
import { z, ZodError, type ZodSchema } from "zod";
import { checkRateLimit } from "./rate-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function notFound(msg = "Not found"): never {
  throw new HttpError(404, msg);
}

export function badRequest(msg = "Bad request"): never {
  throw new HttpError(400, msg);
}

type Handler<T> = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<T> | T;

export function json<T>(handler: Handler<T>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const pathname = new URL(req.url).pathname;
    const isLogin = pathname === "/api/auth/login";
    const rl = checkRateLimit(`${ip}:${pathname}`, isLogin
      ? { max: 5, windowMs: 15 * 60 * 1000 }
      : { max: 120, windowMs: 60 * 1000 }
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
    try {
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

export async function readBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const raw = await req.json().catch(() => badRequest("Invalid JSON"));
  return schema.parse(raw);
}

export async function readId(ctx: { params: Promise<Record<string, string>> }): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) badRequest(`Invalid id: ${id}`);
  return n;
}
