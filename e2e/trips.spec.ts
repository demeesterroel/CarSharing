import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi, getTestEntities } from "./helpers";

/**
 * Trip CRUD + dashboard delta tests.
 *
 * Strategy:
 * - Create a trip via the API in beforeEach (data isolation).
 * - Assert it appears in the trips list UI.
 * - Capture the dashboard km/amount delta before and after creation.
 * - Delete via the API in afterEach (cleanup).
 */

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

// Odometer values chosen so they don't collide with real records.
// km = END - START = 42
const START_ODO = 999_900;
const END_ODO = 999_942;
const LOCATION = "E2E-Test-Location-Trips";

test.describe("trips CRUD", () => {
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

    // Create a trip via API
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
    // Best-effort cleanup — trip may already have been deleted by the test itself
    if (!tripId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request);
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/trips/${tripId}`);
    } catch {
      // Ignore — trip already deleted
    }
  });

  test("trip appears in the trips list after creation", async ({ page }) => {
    // Log in first
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });

    await page.goto("/trips");
    await page.waitForLoadState("networkidle");

    // The TripCard renders the location as the primary text
    await expect(page.locator(`text=${LOCATION}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard km increases after trip creation", async ({ request }) => {
    // Fetch dashboard before trip — re-fetch fresh to get baseline
    // (trip was already inserted in beforeEach, so we compare before vs. after delete+re-add)
    // Instead, we capture the current dashboard state which already has the trip,
    // then delete the trip and re-fetch to confirm the km decreased.

    const dashWithTrip = await api.get<Array<{
      person_id: number;
      trip_count: number;
      trip_km: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWith = dashWithTrip.find((r) => r.person_id === personId);
    const kmWith = rowWith?.trip_km ?? 0;
    const countWith = rowWith?.trip_count ?? 0;

    // Now delete the trip
    await api.delete(`/api/trips/${tripId}`);

    const dashWithout = await api.get<Array<{
      person_id: number;
      trip_count: number;
      trip_km: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWithout = dashWithout.find((r) => r.person_id === personId);
    const kmWithout = rowWithout?.trip_km ?? 0;
    const countWithout = rowWithout?.trip_count ?? 0;

    // After deleting our 42 km trip, total km should have gone down by exactly 42
    expect(kmWith - kmWithout).toBe(END_ODO - START_ODO);
    expect(countWith - countWithout).toBe(1);

    // Mark as already deleted so afterEach doesn't try again
    tripId = 0;
  });

  test("trip disappears from the list after deletion", async ({ page }) => {
    // Log in
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });

    await page.goto("/trips");
    await page.waitForLoadState("networkidle");

    // Confirm trip is visible
    await expect(page.locator(`text=${LOCATION}`).first()).toBeVisible({ timeout: 10_000 });

    // Delete via API
    await api.delete(`/api/trips/${tripId}`);
    tripId = 0;

    // Reload and confirm the trip is gone
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(`text=${LOCATION}`)).toHaveCount(0);
  });
});
