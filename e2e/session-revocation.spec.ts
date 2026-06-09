import { expect, test, type APIRequestContext } from "@playwright/test";

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
// Use a DEDICATED user, not the shared TEST_EMAIL (alice). logout-all bumps the
// user's session epoch in the shared demo.db; if this ran as the same account the
// CRUD specs authenticate with, it would revoke their in-flight sessions under
// parallel execution and they'd 403 with "Session revoked".
const EMAIL = process.env.TEST_REVOKE_EMAIL ?? "carol";
const PASSWORD = process.env.TEST_REVOKE_PASSWORD ?? "carol";

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

/**
 * Client-side guard for server-side revocation (issue #284).
 *
 * The data layer revokes correctly (a stale-epoch cookie 403s on every API
 * call), but the SPA must also *react*: a revoked-but-undestroyed cookie still
 * passes the Edge proxy's cookie-only auth gate, so page navigation succeeds and
 * the user keeps seeing app shells instead of being bounced to /login.
 *
 * Repro: device A is a real browser session; device B (same user) triggers
 * "log out everywhere", bumping the shared session epoch — which revokes A's
 * still-present cookie without destroying it. A fresh navigation in A must end
 * up on /login.
 */
test.describe("Session revocation — client guard (#284)", () => {
  test("a browser whose cookie was revoked elsewhere is bounced to /login", async ({
    browser,
    playwright,
  }) => {
    // Device A — a real browser tab, logged in as the dedicated revoke user.
    const ctxA = await browser.newContext({ baseURL });
    const pageA = await ctxA.newPage();
    const loginA = await pageA.request.post("/api/auth/login", {
      data: { username: EMAIL, password: PASSWORD },
    });
    test.skip(!loginA.ok(), "Test account not available — needs seeded demo data");

    await pageA.goto("/trips");
    await pageA.waitForLoadState("networkidle");
    // Sanity: device A is authenticated (not already sitting on /login).
    expect(new URL(pageA.url()).pathname).not.toBe("/login");

    // Device B — a second session for the same user that triggers "log out
    // everywhere". This bumps the user's session epoch, revoking device A's
    // still-present cookie while only destroying device B's own cookie.
    const ctxB = await playwright.request.newContext({ baseURL });
    await ctxB.post("/api/auth/login", { data: { username: EMAIL, password: PASSWORD } });
    await ctxB.get("/api/me"); // primes csrf-token
    const csrf = (await ctxB.storageState()).cookies.find((c) => c.name === "csrf-token")?.value;
    const revokeStatus = await ctxB
      .post("/api/auth/logout-all", { headers: csrf ? { "x-csrf-token": csrf } : {} })
      .then((r) => r.status());
    expect(revokeStatus).toBe(200);
    await ctxB.dispose();

    // Device A's cookie is now revoked-but-present. The SPA must bounce it to
    // /login on the next navigation (today it stays on /trips — the bug).
    await pageA.goto("/trips");
    await pageA.waitForURL(/\/login/, { timeout: 15_000 });

    await ctxA.close();
  });
});
