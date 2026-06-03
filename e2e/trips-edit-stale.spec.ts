import { test, expect } from "@playwright/test";
import { loginAndGetCsrf, loginAndGetSession, makeApi, getTestEntities } from "./helpers";

/**
 * Reproduction for issue #321:
 * Edit trip A, close the edit form with the X, then click to edit trip B.
 * The form must show trip B's data — not trip A's (stale form).
 *
 * Root cause suspected: app/trips/page.tsx renders <TripForm defaultValues={editing}>
 * without key={editing.id}, and react-hook-form only applies defaultValues on mount,
 * so the form keeps the first-opened trip's values.
 */

// Far-future date so both test trips sort to the very top of the date-grouped
// list (demo data runs into 2027) and are rendered (the list is lazy).
const TODAY = "2030-06-15";
const STAMP = Date.now();
const A = { start: 700001, end: 700051, location: `EDIT-A-${STAMP}` };
const B = { start: 800002, end: 800052, location: `EDIT-B-${STAMP}` };

test.describe("trip edit form is not stale across close→reopen (#321)", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let personId: number;
  let carId: number;
  let tripA: number;
  let tripB: number;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "alice", "alice");
    csrf = session.csrf;
    api = makeApi(request, csrf);
    const entities = await getTestEntities(api);
    personId = session.personId ?? entities.personId;
    carId = entities.carId;

    const base = { person_id: personId, car_id: carId, date: TODAY };
    tripA = (
      await api.post<{ id: number }>("/api/trips", {
        ...base,
        start_odometer: A.start,
        end_odometer: A.end,
        location: A.location,
      })
    ).id;
    tripB = (
      await api.post<{ id: number }>("/api/trips", {
        ...base,
        start_odometer: B.start,
        end_odometer: B.end,
        location: B.location,
      })
    ).id;
  });

  test.afterEach(async ({ request }) => {
    const cleanupCsrf = await loginAndGetCsrf(request, "alice", "alice");
    const cleanup = makeApi(request, cleanupCsrf);
    for (const id of [tripA, tripB]) {
      if (id) await cleanup.delete(`/api/trips/${id}`).catch(() => {});
    }
  });

  test("opening trip B after closing trip A shows B's data", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });
    await page.goto("/trips");
    await page.waitForLoadState("networkidle");

    const startOdo = page.locator('input[name="start_odometer"]');

    // 1) Open trip A → form shows A's start odometer.
    await page.getByText(A.location).first().click();
    await expect(startOdo).toBeVisible({ timeout: 10_000 });
    await expect(startOdo).toHaveValue(String(A.start));

    // 2) Close with the X (aria-label "Sluiten"/"Close").
    await page.locator('[aria-label="Sluiten"], [aria-label="Close"]').first().click();
    await expect(startOdo).toBeHidden({ timeout: 10_000 });

    // 3) Open trip B → form MUST show B's start odometer, not A's (the #321 bug).
    await page.getByText(B.location).first().click();
    await expect(startOdo).toBeVisible({ timeout: 10_000 });
    await expect(startOdo).toHaveValue(String(B.start));
  });
});
