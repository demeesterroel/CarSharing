import { test, expect } from "@playwright/test";

async function loginViaApi(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/login", {
    data: {
      username: process.env.TEST_EMAIL ?? "test@example.com",
      password: process.env.TEST_PASSWORD ?? "changeme",
    },
  });
}

test("admin inbox shows skeleton while reservations API is blocked", async ({ page }) => {
  await loginViaApi(page);

  let resolveReservations!: () => void;
  const blocker = new Promise<void>((resolve) => {
    resolveReservations = resolve;
  });

  await page.route("**/api/reservations", async (route) => {
    await blocker;
    await route.continue();
  });

  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByTestId("admin-inbox-skeleton")).toBeVisible({ timeout: 5000 });

  resolveReservations();
  await expect(page.getByTestId("admin-inbox-skeleton")).not.toBeVisible({ timeout: 8000 });
});

test("admin gaps section shows skeleton while admin-summary API is blocked", async ({ page }) => {
  await loginViaApi(page);

  let resolveAdminSummary!: () => void;
  const blocker = new Promise<void>((resolve) => {
    resolveAdminSummary = resolve;
  });

  await page.route("**/api/admin/summary**", async (route) => {
    await blocker;
    await route.continue();
  });

  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByTestId("admin-gaps-skeleton")).toBeVisible({ timeout: 5000 });

  resolveAdminSummary();
  await expect(page.getByTestId("admin-gaps-skeleton")).not.toBeVisible({ timeout: 8000 });
});

test("admin page has no spinner", async ({ page }) => {
  await loginViaApi(page);
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
