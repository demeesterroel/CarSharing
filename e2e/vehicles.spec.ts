import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi, scrollToLoadAll } from "./helpers";

/**
 * Vehicles CRUD e2e tests.
 *
 * Strategy:
 * - Admin creates a car via API in beforeEach.
 * - Assert it appears in the /vehicles list UI.
 * - Update name via PUT, verify the change.
 * - Delete via the API in afterEach (cleanup).
 *
 * Uses unique "short" code (E2ET) to avoid collisions with demo data.
 */

const PRICE_PER_KM = 0.25;

test.describe("vehicles CRUD", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let carId: number;
  // Unique per test so a failed cleanup never collides on the UNIQUE cars.short
  // constraint (short is capped at 10 chars). A car with reservations/trips also
  // can't be hard-deleted, so unique values keep the tests independent regardless.
  let carShort: string;
  let carName: string;
  let carNameUpdated: string;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const suffix = `${Date.now() % 100000}`;
    carShort = `E2E${suffix}`; // ≤ 8 chars, within the 10-char limit
    carName = `E2E-Test-Vehicle-${suffix}`;
    carNameUpdated = `${carName}-Updated`;

    const res = await api.post<{ id: number }>("/api/vehicles", {
      short: carShort,
      name: carName,
      price_per_km: PRICE_PER_KM,
    });
    carId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!carId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request, "admin", "admin");
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/vehicles/${carId}`);
    } catch {
      // Ignore — car may have been deleted or deactivated already
    }
  });

  test("vehicle appears in the vehicles list after creation", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${carName}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("vehicle name updates via PUT and change appears in list", async ({ page }) => {
    // Update via API
    await api.put<{ ok: boolean }>(`/api/vehicles/${carId}`, {
      short: carShort,
      name: carNameUpdated,
      price_per_km: PRICE_PER_KM,
    });

    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${carNameUpdated}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(carName, { exact: true })).toHaveCount(0);
  });

  test("vehicle disappears from list after deletion", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${carName}`).first()).toBeVisible({ timeout: 10_000 });

    await api.delete(`/api/vehicles/${carId}`);
    carId = 0;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(carName, { exact: true })).toHaveCount(0);
  });
});
