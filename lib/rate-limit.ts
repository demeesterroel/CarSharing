type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): { ok: boolean; retryAfter?: number } {
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
