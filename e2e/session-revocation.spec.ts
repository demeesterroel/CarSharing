import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * E2E for "log out everywhere" / server-side session revocation (issue #266).
 *
 * Bumping the user's session epoch must invalidate every previously issued
 * cookie — including sessions held by other devices — on the next request.
 *
 * Note: GET /api/me rotates the csrf-token cookie on every call, so the CSRF
 * token is read from the context's cookie jar (storageState) immediately before
 * each mutating call rather than captured earlier.
 */

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
  await ctx.get("/api/me"); // sets the csrf-token cookie
  return true;
}

async function logoutAll(ctx: APIRequestContext): Promise<number> {
  const csrf = await currentCsrf(ctx);
  const res = await ctx.post("/api/auth/logout-all", {
    headers: csrf ? { "x-csrf-token": csrf } : {},
  });
  return res.status();
}

test.describe("Session revocation", () => {
  test("logout-all revokes the current session", async ({ request }) => {
    const ok = await login(request);
    test.skip(!ok, "Test account not available — needs seeded demo data");

    expect(await (await request.get("/api/me")).json()).not.toBeNull();

    const status = await logoutAll(request);
    expect(status).toBe(200);

    // The cookie's epoch is now stale → /api/me reports logged out.
    expect(await (await request.get("/api/me")).json()).toBeNull();
  });

  test("logout-all from one device revokes a second device's session", async ({ playwright }) => {
    const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
    const deviceA = await playwright.request.newContext({ baseURL });
    const deviceB = await playwright.request.newContext({ baseURL });

    const okA = await login(deviceA);
    const okB = await login(deviceB);
    test.skip(!okA || !okB, "Test account not available — needs seeded demo data");

    expect(await (await deviceA.get("/api/me")).json()).not.toBeNull();
    expect(await (await deviceB.get("/api/me")).json()).not.toBeNull();

    // Device A triggers "log out everywhere".
    expect(await logoutAll(deviceA)).toBe(200);

    // Device B's previously valid cookie is now revoked.
    expect(await (await deviceB.get("/api/me")).json()).toBeNull();

    await deviceA.dispose();
    await deviceB.dispose();
  });

  test("logout-all requires a CSRF token", async ({ request }) => {
    const ok = await login(request);
    test.skip(!ok, "Test account not available — needs seeded demo data");
    // Deliberately omit the x-csrf-token header.
    const res = await request.post("/api/auth/logout-all", {});
    expect(res.status()).toBe(403);
  });
});
