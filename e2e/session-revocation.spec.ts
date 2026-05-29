import { test, expect, type APIRequestContext } from "@playwright/test";
import { makeApi } from "./helpers";

/**
 * E2E for "log out everywhere" / server-side session revocation (issue #266).
 *
 * Bumping the user's session epoch must invalidate every previously issued
 * cookie — including sessions held by other devices — on the next request.
 */

const EMAIL = process.env.TEST_EMAIL ?? "alice";
const PASSWORD = process.env.TEST_PASSWORD ?? "alice";

/** Logs a fresh context in and returns its CSRF token (or null on failure). */
async function login(ctx: APIRequestContext): Promise<string | null> {
  const res = await ctx.post("/api/auth/login", { data: { username: EMAIL, password: PASSWORD } });
  if (!res.ok()) return null;
  const me = await ctx.get("/api/me");
  for (const h of await me.headersArray()) {
    if (h.name.toLowerCase() === "set-cookie") {
      const m = h.value.match(/csrf-token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
  }
  return null;
}

test.describe("Session revocation", () => {
  test("logout-all revokes the current session", async ({ request }) => {
    const csrf = await login(request);
    test.skip(!csrf, "Test account not available — needs seeded demo data");

    // Confirm we are authenticated.
    const before = await request.get("/api/me");
    expect(await before.json()).not.toBeNull();

    await makeApi(request, csrf!).post("/api/auth/logout-all", {});

    // The cookie's epoch is now stale → /api/me reports logged out.
    const after = await request.get("/api/me");
    expect(await after.json()).toBeNull();
  });

  test("logout-all from one device revokes a second device's session", async ({ playwright }) => {
    const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
    const deviceA = await playwright.request.newContext({ baseURL });
    const deviceB = await playwright.request.newContext({ baseURL });

    const csrfA = await login(deviceA);
    const csrfB = await login(deviceB);
    test.skip(!csrfA || !csrfB, "Test account not available — needs seeded demo data");

    // Both devices are authenticated.
    expect(await (await deviceA.get("/api/me")).json()).not.toBeNull();
    expect(await (await deviceB.get("/api/me")).json()).not.toBeNull();

    // Device A triggers "log out everywhere".
    await makeApi(deviceA, csrfA!).post("/api/auth/logout-all", {});

    // Device B's previously valid cookie is now revoked.
    expect(await (await deviceB.get("/api/me")).json()).toBeNull();

    await deviceA.dispose();
    await deviceB.dispose();
  });

  test("logout-all requires a CSRF token", async ({ request }) => {
    const csrf = await login(request);
    test.skip(!csrf, "Test account not available — needs seeded demo data");
    // Deliberately omit the x-csrf-token header.
    const res = await request.post("/api/auth/logout-all", {});
    expect(res.status()).toBe(403);
  });
});
