import { test, expect } from "@playwright/test";

/**
 * Smoke tests — happy path + offline badge.
 *
 * These tests do NOT rely on auth.setup.ts state storage because the app uses
 * iron-session cookies.  Each test logs in directly via the API so they are
 * self-contained and order-independent.
 */

async function loginViaApi(page: import("@playwright/test").Page) {
  // POST credentials directly — faster than filling the form UI
  await page.request.post("/api/auth/login", {
    data: {
      username: process.env.TEST_EMAIL ?? "alice",
      password: process.env.TEST_PASSWORD ?? "alice",
    },
  });
}

// ---------------------------------------------------------------------------
// Test 1: Login flow + trips page heading
// ---------------------------------------------------------------------------
test("login and view trips", async ({ page }) => {
  await page.goto("/login");

  // Fill the login form
  // Labels come from t("form.name") → "Naam *" / "Name *"
  await page.getByLabel(/naam|name/i).fill(process.env.TEST_EMAIL ?? "alice");
  // t("form.password") → "Wachtwoord" / "Password"
  await page.getByLabel(/wachtwoord|password/i).fill(process.env.TEST_PASSWORD ?? "alice");
  // t("action.login") → "Inloggen" / "Log in"
  await page.getByRole("button", { name: /inloggen|log\s*in/i }).click();

  // After login the app redirects to "/"
  await page.waitForURL(/trips|dashboard|\//);

  // The trips page header title comes from t("page.trips") → "Ritten" (nl) / "Trips" (en)
  // It is rendered as a large heading inside PageHeader.
  // We look for any element containing "Ritt" (Dutch) or "Trip" (English).
  await expect(
    page.locator("text=/ritten|trips/i").first()
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2: Offline badge appears when API requests are blocked
// ---------------------------------------------------------------------------
test("offline badge appears when network is unavailable", async ({ page, context }) => {
  // Log in first so we land on the trips page
  await loginViaApi(page);
  await page.goto("/trips");

  // Wait for the page to finish its initial load (trips list or loading state visible)
  await page.waitForLoadState("networkidle");

  // Strategy A: use Playwright's built-in offline mode.
  // This fires the browser's "offline" event, which the OnlineStateProvider
  // listens to via window.addEventListener("offline", ...).
  await context.setOffline(true);

  // Strategy B (fallback): also abort all API heartbeat requests so the app
  // cannot re-detect connectivity via its /api/health heartbeat.
  await page.route("**/api/**", (route) => route.abort());

  // Give React time to re-render after the offline event
  await page.waitForTimeout(300);

  // The OfflineBadge renders a <span role="status"> with text "OFFLINE"
  // when online===false (from t("offline.label") → "OFFLINE").
  const badge = page.getByRole("status").filter({ hasText: /offline/i });
  await expect(badge).toBeVisible({ timeout: 5_000 });
});
