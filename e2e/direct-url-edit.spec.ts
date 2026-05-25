import { test, expect } from "@playwright/test";
import { loginAndGetCsrf, loginAndGetSession, makeApi, getTestEntities } from "./helpers";

/**
 * Regression test for issue #171:
 * Closing an edit form opened via direct URL (?edit=<id>) should stay on the
 * current page — not navigate away via router.back() into browser history.
 */

const TODAY = new Date().toISOString().slice(0, 10);
const START_ODO = 888_800;
const END_ODO = 888_842;
const LOCATION = "E2E-DirectUrl-Test";

test.describe("direct URL edit — close stays on page", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let tripId: number;
  let personId: number;
  let carId: number;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request);
    csrf = session.csrf;
    api = makeApi(request, csrf);
    const entities = await getTestEntities(api);
    personId = session.personId ?? entities.personId;
    carId = entities.carId;

    const res = await api.post<{ id: number }>("/api/trips", {
      person_id: personId,
      car_id: carId,
      date: TODAY,
      start_odometer: START_ODO,
      end_odometer: END_ODO,
      location: LOCATION,
    });
    tripId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!tripId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request);
      await makeApi(request, cleanupCsrf).delete(`/api/trips/${tripId}`);
    } catch {
      // already deleted
    }
  });

  test("closing edit form opened via direct URL stays on /trips", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: process.env.TEST_EMAIL ?? "alice", password: process.env.TEST_PASSWORD ?? "alice" },
    });
    // Navigate directly to the edit URL — no prior history
    await page.goto(`/trips?edit=${tripId}`);
    await page.waitForLoadState("networkidle");

    // Edit form should be open
    await expect(page.locator("form")).toBeVisible({ timeout: 10_000 });

    // Click the × close button
    await page.locator('button[aria-label="Sluiten"], button[aria-label="Close"]').first().click();

    // Form must be gone and URL must stay on /trips
    await expect(page.locator("form")).not.toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/^[^?]*\/trips$/, { timeout: 5_000 });
  });

  test("saving edit form opened via direct URL closes form and stays on /trips", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: process.env.TEST_EMAIL ?? "alice", password: process.env.TEST_PASSWORD ?? "alice" },
    });
    await page.goto(`/trips?edit=${tripId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("form")).toBeVisible({ timeout: 10_000 });

    // Submit without changes — just press Save
    await page.locator('button[type="submit"]').click();

    // Form must close, toast shown, URL stays on /trips without ?edit=
    await expect(page.locator("form")).not.toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/^[^?]*\/trips$/, { timeout: 5_000 });
  });

  test("closing edit form opened via direct URL stays on /fuel", async ({ page, request }) => {
    const fuelCsrf = await loginAndGetCsrf(request);
    const fuelApi = makeApi(request, fuelCsrf);
    const entities = await getTestEntities(fuelApi);

    const fuel = await fuelApi.post<{ id: number }>("/api/fuel", {
      person_id: entities.personId,
      car_id: entities.carId,
      date: TODAY,
      amount: 50,
      liters: 30,
      full_tank: 0,
      settled_outside: 0,
    });

    await page.request.post("/api/auth/login", {
      data: { username: process.env.TEST_EMAIL ?? "alice", password: process.env.TEST_PASSWORD ?? "alice" },
    });
    await page.goto(`/fuel?edit=${fuel.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("form")).toBeVisible({ timeout: 10_000 });

    await page.locator('button[aria-label="Sluiten"], button[aria-label="Close"]').first().click();
    await expect(page).toHaveURL(/\/fuel/, { timeout: 5_000 });

    // cleanup
    try { await fuelApi.delete(`/api/fuel/${fuel.id}`); } catch { /**/ }
  });

  test("closing edit form opened via direct URL stays on /expenses", async ({ page, request }) => {
    const expCsrf = await loginAndGetCsrf(request);
    const expApi = makeApi(request, expCsrf);
    const entities = await getTestEntities(expApi);

    const exp = await expApi.post<{ id: number }>("/api/expenses", {
      person_id: entities.personId,
      car_id: entities.carId,
      date: TODAY,
      amount: 25,
      description: "E2E-DirectUrl-Expense",
      category: "diversen",
    });

    await page.request.post("/api/auth/login", {
      data: { username: process.env.TEST_EMAIL ?? "alice", password: process.env.TEST_PASSWORD ?? "alice" },
    });
    await page.goto(`/expenses?edit=${exp.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("form")).toBeVisible({ timeout: 10_000 });

    await page.locator('button[aria-label="Sluiten"], button[aria-label="Close"]').first().click();
    await expect(page).toHaveURL(/\/expenses/, { timeout: 5_000 });

    try { await expApi.delete(`/api/expenses/${exp.id}`); } catch { /**/ }
  });
});
