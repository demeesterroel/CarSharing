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

const CAR_SHORT = "E2ET";
const CAR_NAME = "E2E-Test-Vehicle";
const CAR_NAME_UPDATED = "E2E-Test-Vehicle-Updated";
const PRICE_PER_KM = 0.25;

test.describe("vehicles CRUD", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let carId: number;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const res = await api.post<{ id: number }>("/api/vehicles", {
      short: CAR_SHORT,
      name: CAR_NAME,
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

    await expect(page.locator(`text=${CAR_NAME}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("vehicle name updates via PUT and change appears in list", async ({ page }) => {
    // Update via API
    await api.put<{ ok: boolean }>(`/api/vehicles/${carId}`, {
      short: CAR_SHORT,
      name: CAR_NAME_UPDATED,
      price_per_km: PRICE_PER_KM,
    });

    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${CAR_NAME_UPDATED}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(CAR_NAME, { exact: true })).toHaveCount(0);
  });

  test("vehicle disappears from list after deletion", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${CAR_NAME}`).first()).toBeVisible({ timeout: 10_000 });

    await api.delete(`/api/vehicles/${carId}`);
    carId = 0;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(CAR_NAME, { exact: true })).toHaveCount(0);
  });
});
