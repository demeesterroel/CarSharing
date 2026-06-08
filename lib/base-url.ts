import { env } from "@/lib/env";

/**
 * Resolve the absolute base URL for links generated server-side (invite, magic
 * link, password reset, calendar webhook callback).
 *
 * In development the configured `NEXT_PUBLIC_BASE_URL` is typically a fixed
 * `http://localhost:3000`, which is wrong whenever the dev server runs on a
 * different port — so derive the base URL from the actual request instead.
 *
 * In production (and under the test runner) the configured canonical URL stays
 * authoritative, falling back to the request origin only when it isn't set.
 */
export function resolveBaseUrl(req: Request): string {
  if (process.env.NODE_ENV === "development") {
    return new URL(req.url).origin;
  }
  return env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
}
