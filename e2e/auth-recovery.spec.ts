import { test, expect, request as playwrightRequest } from "@playwright/test";

const EMAIL = process.env.TEST_EMAIL ?? "alice";
const PASSWORD = process.env.TEST_PASSWORD ?? "alice";

/**
 * E2E for self-service account recovery (issue #267):
 *   - "Forgot password?" link + /forgot page
 *   - password-reset and magic-link request endpoints (no account enumeration)
 *   - invalid reset / magic tokens are rejected
 *
 * These tests are self-contained: the request endpoints always return 200 and
 * never reveal whether an account exists, so they need no seeded data.
 */

test.describe("Account recovery", () => {
  test("login page links to the forgot-password page", async ({ page }) => {
    await page.goto("/login");
    const link = page.getByRole("link", { name: /forgot|vergeten/i });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/forgot/);
    // The email field is focused and present.
    await expect(page.locator("#forgot-email")).toBeVisible();
  });

  test("submitting the forgot form shows a neutral confirmation", async ({ page }) => {
    await page.goto("/forgot");
    await page.locator("#forgot-email").fill("definitely-not-a-user@example.com");
    await page.getByRole("button", { name: /reset link|resetlink/i }).click();
    // A status message is shown regardless of whether the account exists.
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("POST /api/auth/forgot returns 200 for an unknown email (no enumeration)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/forgot", {
      data: { email: "nobody-" + Date.now() + "@example.com" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("POST /api/auth/magic returns 200 for an unknown email (no enumeration)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/magic", {
      data: { email: "nobody-" + Date.now() + "@example.com" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("an invalid reset token is rejected", async ({ request }) => {
    const res = await request.post("/api/auth/reset/not-a-real-token", {
      data: { password: "a-strong-password" },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  test("an invalid magic-link token redirects to login", async ({ request }) => {
    const res = await request.get("/api/auth/magic/not-a-real-token", {
      maxRedirects: 0,
    });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toContain("/login");
  });
});

/**
 * Recovery pages are guest-only (issue #275): an already-authenticated user is
 * redirected away from /forgot and /reset/<token>, the same way /login already
 * redirects logged-in users. Logged-out users must still reach them.
 *
 * Each test uses its own request context (cookie jar) so the logged-in and
 * logged-out cases don't share session state.
 */
test.describe("Recovery pages are guest-only", () => {
  /** Path of the Location header, or "" if absent. */
  function redirectPath(location: string | undefined): string {
    if (!location) return "";
    return new URL(location, "http://localhost").pathname;
  }

  test("a logged-in user visiting /forgot is redirected to /", async () => {
    const ctx = await playwrightRequest.newContext();
    const login = await ctx.post("/api/auth/login", {
      data: { username: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBe(true);

    const res = await ctx.get("/forgot", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(redirectPath(res.headers()["location"])).toBe("/");
    await ctx.dispose();
  });

  test("a logged-in user visiting /reset/<token> is redirected to /", async () => {
    const ctx = await playwrightRequest.newContext();
    const login = await ctx.post("/api/auth/login", {
      data: { username: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBe(true);

    const res = await ctx.get("/reset/some-token", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(redirectPath(res.headers()["location"])).toBe("/");
    await ctx.dispose();
  });

  test("a logged-out user can still reach /forgot", async () => {
    const ctx = await playwrightRequest.newContext();
    const res = await ctx.get("/forgot", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });
});
