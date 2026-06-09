import { test, expect, request as playwrightRequest } from "@playwright/test";
import { loginAndGetSession, makeApi, scrollToLoadAll } from "./helpers";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

/**
 * In-app notifications (#358).
 *
 * Alice opts in to "new reservations (all cars)". Bob (a different non-admin
 * user) creates a reservation → Alice gets an in-app notification: unread count
 * rises, the /notifications page lists it, clicking deep-links to the
 * reservation on /calendar, and viewing the page clears the unread count.
 */
test.describe("in-app notifications (#358)", () => {
  test("opted-in user is notified of another user's new reservation", async ({ page, request }) => {
    // Alice opts in to all new reservations (via her own profile).
    const alice = await loginAndGetSession(request, "alice", "alice");
    test.skip(alice.personId == null, "needs seeded alice");
    const aliceApi = makeApi(request, alice.csrf);
    await aliceApi.patch(`/api/people/${alice.personId}/profile`, {
      first_name: "Alice",
      notify_new_reservations: "all",
    });
    // Clear any pre-existing unread for a deterministic count.
    await aliceApi.post("/api/notifications/read", {});

    // Bob (a different non-admin actor, own cookie jar) creates a reservation.
    const bobCtx = await playwrightRequest.newContext({ baseURL });
    const bob = await loginAndGetSession(bobCtx, "bob", "bob");
    const bobApi = makeApi(bobCtx, bob.csrf);
    const cars = await bobApi.get<Array<{ id: number }>>("/api/vehicles");
    const day = futureDate(30);
    const resv = await bobApi.post<{ id: number }>("/api/reservations", {
      person_id: bob.personId,
      car_id: cars[0].id,
      start_date: day,
      end_date: day,
      note: "E2E-notif-resv",
    });

    // Alice now has exactly one unread notification for that reservation.
    await expect
      .poll(
        async () =>
          (await aliceApi.get<{ count: number }>("/api/notifications/unread-count")).count,
        { timeout: 10_000 }
      )
      .toBe(1);
    const list = await aliceApi.get<Array<{ entity_type: string; entity_id: number }>>(
      "/api/notifications"
    );
    expect(list[0]).toMatchObject({ entity_type: "reservation", entity_id: resv.id });

    // Browser: the notifications page lists it; clicking deep-links to /calendar.
    await page.request.post("/api/auth/login", { data: { username: "alice", password: "alice" } });
    // Warm the session (loads the app → /api/me sets the csrf-token cookie), the
    // way a real user reaches /notifications from inside the app via the bell.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);
    const row = page.getByRole("link").filter({ hasText: /reserv/i }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Still unread on view (no auto-mark) — the unread count holds.
    expect(
      (await aliceApi.get<{ count: number }>("/api/notifications/unread-count")).count
    ).toBe(1);

    // The "mark all read" button clears the unread count.
    await page.getByRole("button", { name: "Alles gelezen" }).click();
    await expect
      .poll(
        async () =>
          (await aliceApi.get<{ count: number }>("/api/notifications/unread-count")).count,
        { timeout: 10_000 }
      )
      .toBe(0);

    // Clicking the notification still deep-links to the reservation on the calendar.
    await row.click();
    await page.waitForURL(new RegExp(`/calendar\\?reservation=${resv.id}`));

    await bobCtx.dispose();
  });

  test("opening a notification marks just that one read", async ({ page, request }) => {
    const alice = await loginAndGetSession(request, "alice", "alice");
    test.skip(alice.personId == null, "needs seeded alice");
    const aliceApi = makeApi(request, alice.csrf);
    await aliceApi.patch(`/api/people/${alice.personId}/profile`, {
      first_name: "Alice",
      notify_new_reservations: "all",
    });
    await aliceApi.post("/api/notifications/read", {}); // baseline clear

    const bobCtx = await playwrightRequest.newContext({ baseURL });
    const bob = await loginAndGetSession(bobCtx, "bob", "bob");
    const bobApi = makeApi(bobCtx, bob.csrf);
    const cars = await bobApi.get<Array<{ id: number }>>("/api/vehicles");
    const resv = await bobApi.post<{ id: number }>("/api/reservations", {
      person_id: bob.personId,
      car_id: cars[0].id,
      start_date: futureDate(45),
      end_date: futureDate(45),
      note: "E2E-notif-click",
    });

    await expect
      .poll(
        async () =>
          (await aliceApi.get<{ count: number }>("/api/notifications/unread-count")).count,
        { timeout: 10_000 }
      )
      .toBe(1);

    await page.request.post("/api/auth/login", { data: { username: "alice", password: "alice" } });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    // Clicking the notification deep-links AND marks just that one read.
    const row = page.getByRole("link").filter({ hasText: /reserv/i }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();
    await page.waitForURL(new RegExp(`/calendar\\?reservation=${resv.id}`));

    await expect
      .poll(
        async () =>
          (await aliceApi.get<{ count: number }>("/api/notifications/unread-count")).count,
        { timeout: 10_000 }
      )
      .toBe(0);

    await bobCtx.dispose();
  });
});

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
