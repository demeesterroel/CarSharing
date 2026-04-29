import { test, expect } from "@playwright/test";
import { loginAndGetCsrf, makeApi, getTestEntities } from "./helpers";

/**
 * Fuel fill-up CRUD + dashboard delta tests.
 *
 * Strategy:
 * - Create a fill-up via the API in beforeEach (data isolation).
 * - Assert it appears in the /fuel list UI.
 * - Verify the dashboard fuel_count and fuel_liters delta.
 * - Delete via the API in afterEach (cleanup).
 */

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

// Distinctive location text so the card is easy to locate in the UI
const LOCATION = "E2E-Test-Station-Fuel";
const AMOUNT = 74.23;
const LITERS = 42.0;

test.describe("fuel fill-up CRUD", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let fillupId: number;
  let personId: number;
  let carId: number;

  test.beforeEach(async ({ request }) => {
    csrf = await loginAndGetCsrf(request);
    api = makeApi(request, csrf);

    const entities = await getTestEntities(api);
    personId = entities.personId;
    carId = entities.carId;

    const res = await api.post<{ id: number }>("/api/fuel", {
      person_id: personId,
      car_id: carId,
      date: TODAY,
      amount: AMOUNT,
      liters: LITERS,
      location: LOCATION,
    });
    fillupId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!fillupId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request);
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/fuel/${fillupId}`);
    } catch {
      // Ignore — fill-up already deleted
    }
  });

  test("fill-up appears in the fuel list after creation", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "test@example.com",
        password: process.env.TEST_PASSWORD ?? "changeme",
      },
    });

    await page.goto("/fuel");
    await page.waitForLoadState("networkidle");

    // FuelCard renders: ⛽ {location} — look for the location text
    await expect(page.locator(`text=${LOCATION}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard fuel_liters increases by the fill-up liters", async ({ request }) => {
    const dashWithFillup = await api.get<Array<{
      person_id: number;
      fuel_count: number;
      fuel_liters: number;
      fuel_amount: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWith = dashWithFillup.find((r) => r.person_id === personId);
    const litersWithFillup = rowWith?.fuel_liters ?? 0;
    const countWithFillup = rowWith?.fuel_count ?? 0;

    // Delete the fill-up and compare
    await api.delete(`/api/fuel/${fillupId}`);
    fillupId = 0;

    const dashWithout = await api.get<Array<{
      person_id: number;
      fuel_count: number;
      fuel_liters: number;
      fuel_amount: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWithout = dashWithout.find((r) => r.person_id === personId);
    const litersWithout = rowWithout?.fuel_liters ?? 0;
    const countWithout = rowWithout?.fuel_count ?? 0;

    // Delta should equal exactly the fill-up liters
    expect(litersWithFillup - litersWithout).toBeCloseTo(LITERS, 2);
    expect(countWithFillup - countWithout).toBe(1);
  });

  test("fill-up disappears from the list after deletion", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "test@example.com",
        password: process.env.TEST_PASSWORD ?? "changeme",
      },
    });

    await page.goto("/fuel");
    await page.waitForLoadState("networkidle");

    // Confirm visible
    await expect(page.locator(`text=${LOCATION}`).first()).toBeVisible({ timeout: 10_000 });

    // Delete
    await api.delete(`/api/fuel/${fillupId}`);
    fillupId = 0;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(`text=${LOCATION}`)).toHaveCount(0);
  });
});
