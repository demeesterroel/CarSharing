type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

/**
 * Checks an in-memory sliding-window rate limit for the given key.
 * @param key - Unique identifier (e.g. `"<ip>:<pathname>"`).
 * @param options - `max` requests allowed within `windowMs` milliseconds.
 * @returns `{ ok: true }` when under the limit, or `{ ok: false, retryAfter }` in seconds when exceeded.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): { ok: boolean; retryAfter?: number } {
  // Escape hatch for E2E/dev: the Playwright dev server sets this so the suite,
  // which logs in repeatedly from one host, isn't throttled. Never set in prod.
  if (process.env.DISABLE_RATE_LIMIT === "1") return { ok: true };
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }
  if (entry.count >= options.max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}
