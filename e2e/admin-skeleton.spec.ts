import { expect, test } from "@playwright/test";
import { sealData } from "iron-session";

// Must match the password the e2e web server boots with — see
// E2E_SESSION_PASSWORD in playwright.config.ts. If these diverge the sealed
// cookie can't be decrypted and the app redirects /admin → /login.
const SESSION_PASSWORD =
  process.env.SESSION_PASSWORD ?? "autodelen-dev-session-password-32-chars-xyz";

const EMPTY_ADMIN_SUMMARY = {
  carPnL: [],
  settlement: [],
  kmGaps: [],
  zeroKmTrips: [],
  monthlyCarKm: [],
  personContributions: [],
  historicalCarKm: [],
  priceHistory: [],
  rollingFuelPerKm: [],
  historicalOwnerSplit: [],
  historicalExpenses: [],
};

async function setAdminSession(page: import("@playwright/test").Page) {
  const sealed = await sealData(
    { authenticated: true, isAdmin: true, personId: 1, shortName: "Test" },
    { password: SESSION_PASSWORD, ttl: 86400 }
  );
  await page.context().addCookies([
    {
      name: "carsharing_session",
      value: sealed,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

test("admin inbox shows skeleton while reservations API is blocked", async ({ page }) => {
  await setAdminSession(page);

  let resolveReservations!: () => void;
  const blocker = new Promise<void>((resolve) => {
    resolveReservations = resolve;
  });

  await page.route("**/api/reservations", async (route) => {
    await blocker;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByTestId("admin-inbox-skeleton")).toBeVisible({ timeout: 5000 });

  resolveReservations();
  await expect(page.getByTestId("admin-inbox-skeleton")).not.toBeVisible({ timeout: 8000 });
});

test("admin gaps section shows skeleton while admin-summary API is blocked", async ({ page }) => {
  await setAdminSession(page);

  let resolveAdminSummary!: () => void;
  const blocker = new Promise<void>((resolve) => {
    resolveAdminSummary = resolve;
  });

  await page.route("**/api/admin/summary**", async (route) => {
    await blocker;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPTY_ADMIN_SUMMARY),
    });
  });

  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByTestId("admin-gaps-skeleton")).toBeVisible({ timeout: 5000 });

  resolveAdminSummary();
  await expect(page.getByTestId("admin-gaps-skeleton")).not.toBeVisible({ timeout: 8000 });
});

test("admin page has no spinner", async ({ page }) => {
  await setAdminSession(page);
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
