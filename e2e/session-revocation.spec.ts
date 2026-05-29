import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * E2E for "log out everywhere" / server-side session revocation (issue #266).
 *
 * Bumping the user's session epoch must invalidate every previously issued
 * cookie — including sessions held by other devices — on the next request.
 *
 * Each test uses its own freshly created request context (its own cookie jar)
 * so sessions don't leak between tests. GET /api/me rotates the csrf-token
 * cookie, so the CSRF token is read from the jar immediately before each
 * mutating call.
 */

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "alice";
const PASSWORD = process.env.TEST_PASSWORD ?? "alice";

/** Reads the current csrf-token cookie from the context's jar. */
async function currentCsrf(ctx: APIRequestContext): Promise<string | null> {
  const state = await ctx.storageState();
  return state.cookies.find((c) => c.name === "csrf-token")?.value ?? null;
}

/** Logs the context in and primes a csrf-token cookie via /api/me. */
async function login(ctx: APIRequestContext): Promise<boolean> {
  const res = await ctx.post("/api/auth/login", { data: { username: EMAIL, password: PASSWORD } });
  if (!res.ok()) return false;
  const me = await (await ctx.get("/api/me")).json(); // also sets csrf-token
  return me !== null;
}

async function logoutAll(ctx: APIRequestContext): Promise<number> {
  const csrf = await currentCsrf(ctx);
  const res = await ctx.post("/api/auth/logout-all", {
    headers: csrf ? { "x-csrf-token": csrf } : {},
  });
  return res.status();
}

/**
 * Returns true if the context is logged out. A revoked-but-present cookie still
 * passes the proxy auth gate, so /api/me returns `null` JSON; a destroyed cookie
 * (current-session logout) fails the gate and the proxy redirects /api/me to
 * /login (HTML). Treat both as logged out.
 */
async function isLoggedOut(ctx: APIRequestContext): Promise<boolean> {
  const res = await ctx.get("/api/me");
  const ct = res.headers()["content-type"] ?? "";
  if (!ct.includes("application/json")) return true; // redirected to /login HTML
  return (await res.json()) === null;
}

async function isLoggedIn(ctx: APIRequestContext): Promise<boolean> {
  const res = await ctx.get("/api/me");
  if (!(res.headers()["content-type"] ?? "").includes("application/json")) return false;
  return (await res.json()) !== null;
}

test.describe("Session revocation", () => {
  test("logout-all revokes the current session", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const ok = await login(ctx);
    test.skip(!ok, "Test account not available — needs seeded demo data");

    expect(await isLoggedIn(ctx)).toBe(true);

    expect(await logoutAll(ctx)).toBe(200);

    // The current session was destroyed → no longer logged in.
    expect(await isLoggedOut(ctx)).toBe(true);

    await ctx.dispose();
  });

  test("logout-all from one device revokes a second device's session", async ({ playwright }) => {
    const deviceA = await playwright.request.newContext({ baseURL });
    const deviceB = await playwright.request.newContext({ baseURL });

    const okA = await login(deviceA);
    const okB = await login(deviceB);
    test.skip(!okA || !okB, "Test account not available — needs seeded demo data");

    expect(await isLoggedIn(deviceA)).toBe(true);
    expect(await isLoggedIn(deviceB)).toBe(true);

    // Device A triggers "log out everywhere".
    expect(await logoutAll(deviceA)).toBe(200);

    // Device B's previously valid cookie is now revoked.
    expect(await isLoggedOut(deviceB)).toBe(true);

    await deviceA.dispose();
    await deviceB.dispose();
  });

  test("logout-all requires a CSRF token", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const ok = await login(ctx);
    test.skip(!ok, "Test account not available — needs seeded demo data");
    // Deliberately omit the x-csrf-token header.
    const res = await ctx.post("/api/auth/logout-all", {});
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });
});
