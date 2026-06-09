import { expect, test } from "@playwright/test";
import { getTestEntities, loginAndGetCsrf, makeApi } from "./helpers";

/**
 * Reservation approval flow — two-role test.
 *
 * Flow:
 * 1. Regular user creates a reservation via the API (status: pending).
 * 2. Admin context opens /admin and asserts the reservation appears in the inbox.
 * 3. Admin approves the reservation via the UI confirm button.
 * 4. Regular user's calendar page shows the reservation with status "confirmed".
 *
 * Cleanup: delete the reservation in afterEach.
 *
 * Two-account setup:
 *   TEST_EMAIL / TEST_PASSWORD          — regular user
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — admin (falls back to same as regular user
 *   if the regular user is already an admin, which is common in single-account test setups)
 */

// Future dates to avoid conflicts with existing real reservations
const FUTURE_START = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10); // +60 days
const FUTURE_END = new Date(Date.now() + 62 * 86400_000).toISOString().slice(0, 10); // +62 days

test.describe("reservation approval flow", () => {
  let userCsrf: string;
  let userApi: ReturnType<typeof makeApi>;
  let reservationId: number;
  let personId: number;
  let carId: number;

  test.beforeEach(async ({ request }) => {
    // Log in as regular user to create the reservation
    userCsrf = await loginAndGetCsrf(
      request,
      process.env.TEST_EMAIL ?? "alice",
      process.env.TEST_PASSWORD ?? "alice"
    );
    userApi = makeApi(request, userCsrf);

    const entities = await getTestEntities(userApi);
    personId = entities.personId;
    carId = entities.carId;

    const res = await userApi.post<{ id: number }>("/api/reservations", {
      person_id: personId,
      car_id: carId,
      start_date: FUTURE_START,
      end_date: FUTURE_END,
      note: "E2E-test-reservation",
    });
    reservationId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!reservationId) return;
    try {
      // Use admin credentials for cleanup (reservation delete may be admin-only)
      const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin";
      const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "admin";
      const cleanupCsrf = await loginAndGetCsrf(request, adminEmail, adminPassword);
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/reservations/${reservationId}`);
    } catch {
      // Ignore
    }
  });

  test("pending reservation appears in admin inbox and can be approved", async ({ browser }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "admin";

    // ── Admin context ──────────────────────────────────────────────────────────
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      // Log in as admin
      await adminPage.request.post("/api/auth/login", {
        data: { username: adminEmail, password: adminPassword },
      });

      // Navigate to the admin inbox
      await adminPage.goto("/admin");
      await adminPage.waitForLoadState("networkidle");

      // The pending reservation card should be visible.
      // The admin inbox renders: person_name, start_date, end_date, note.
      // We match on our unique note text.
      const reservationNote = adminPage.getByText("E2E-test-reservation").first();
      await expect(reservationNote).toBeVisible({ timeout: 10_000 });

      // Click the confirm button for OUR reservation, addressed by id. There may be
      // several pending reservations (sibling tests, parallel workers) sharing the
      // same start_date and note, so the inbox order is undefined — a ".first()"
      // selector could confirm a different reservation and leave ours pending.
      const confirmBtn = adminPage.getByTestId(`confirm-${reservationId}`);
      await expect(confirmBtn).toBeVisible({ timeout: 10_000 });

      // Wait for the PATCH .../status response triggered by the click, rather
      // than a fixed timeout — removes the race that left status === "pending".
      const statusResponse = adminPage.waitForResponse(
        (r) =>
          new RegExp(`/api/reservations/${reservationId}/status$`).test(r.url()) &&
          r.request().method() === "PATCH"
      );
      await confirmBtn.click();
      await statusResponse;

      // Poll the API until the status flips (poll auto-retries, so a single
      // transient read error — e.g. ECONNRESET — no longer fails the test).
      await expect
        .poll(
          async () => {
            const res = await adminPage.request.get("/api/reservations");
            if (!res.ok()) return undefined;
            const all = (await res.json()) as Array<{ id: number; status: string }>;
            return all.find((r) => r.id === reservationId)?.status;
          },
          { timeout: 10_000 }
        )
        .toBe("confirmed");
    } finally {
      await adminContext.close();
    }
  });

  test("approves the targeted reservation when several are pending", async ({ browser }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "admin";

    // Create a second, decoy pending reservation with the SAME start_date as ours.
    // Tied start_date means the inbox order between the two is undefined, so a
    // ".first()" selector cannot reliably target our reservation. The confirm
    // button must be addressable by reservation id.
    const decoy = await userApi.post<{ id: number }>("/api/reservations", {
      person_id: personId,
      car_id: carId,
      start_date: FUTURE_START,
      end_date: FUTURE_END,
      note: "E2E-decoy-reservation",
    });
    const decoyId = decoy.id;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    try {
      await adminPage.request.post("/api/auth/login", {
        data: { username: adminEmail, password: adminPassword },
      });
      await adminPage.goto("/admin");
      await adminPage.waitForLoadState("networkidle");

      // Target OUR reservation's confirm button deterministically by id.
      const confirmBtn = adminPage.getByTestId(`confirm-${reservationId}`);
      await expect(confirmBtn).toBeVisible({ timeout: 10_000 });

      const statusResponse = adminPage.waitForResponse(
        (r) =>
          new RegExp(`/api/reservations/${reservationId}/status$`).test(r.url()) &&
          r.request().method() === "PATCH"
      );
      await confirmBtn.click();
      await statusResponse;

      // Ours flips to confirmed; the decoy must stay pending (we never touched it).
      await expect
        .poll(
          async () => {
            const res = await adminPage.request.get("/api/reservations");
            if (!res.ok()) return undefined;
            const all = (await res.json()) as Array<{ id: number; status: string }>;
            const mine = all.find((r) => r.id === reservationId)?.status;
            const other = all.find((r) => r.id === decoyId)?.status;
            return `${mine}/${other}`;
          },
          { timeout: 10_000 }
        )
        .toBe("confirmed/pending");
    } finally {
      // Clean up the decoy with admin credentials.
      try {
        const cleanupCsrf = await loginAndGetCsrf(adminPage.request, adminEmail, adminPassword);
        const cleanupApi = makeApi(adminPage.request, cleanupCsrf);
        await cleanupApi.delete(`/api/reservations/${decoyId}`);
      } catch {
        // Ignore
      }
      await adminContext.close();
    }
  });

  test("user sees reservation as confirmed after admin approval", async ({ browser, request }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin";
    const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "admin";

    // Approve via API (simulates admin action without needing UI)
    const adminCsrf = await loginAndGetCsrf(request, adminEmail, adminPassword);
    const adminApi = makeApi(request, adminCsrf);
    await adminApi.patch(`/api/reservations/${reservationId}/status`, { status: "confirmed" });

    // ── User context ───────────────────────────────────────────────────────────
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    try {
      await userPage.request.post("/api/auth/login", {
        data: {
          username: process.env.TEST_EMAIL ?? "alice",
          password: process.env.TEST_PASSWORD ?? "alice",
        },
      });

      // Navigate to the calendar page where reservations are listed
      await userPage.goto("/calendar");
      await userPage.waitForLoadState("networkidle");

      // The ReservationCard renders a "✓" when status is "confirmed"
      // and the person_name. Find our reservation by note text.
      const noteText = userPage.getByText("E2E-test-reservation").first();
      await expect(noteText).toBeVisible({ timeout: 10_000 });

      // The status indicator "✓" should be present near our reservation.
      // ReservationCard renders it in the right-column when !isPending.
      const checkmark = userPage.locator("text=✓").first();
      await expect(checkmark).toBeVisible({ timeout: 5_000 });
    } finally {
      await userContext.close();
    }
  });

  test("reservation is visible in pending state before admin action", async ({ page }) => {
    // Log in as the regular user
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });

    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // The ReservationCard for a pending reservation renders "?" as the status indicator.
    // Our note makes it uniquely identifiable.
    await expect(page.locator("text=E2E-test-reservation").first()).toBeVisible({
      timeout: 10_000,
    });

    // Fetch via API to confirm status is still pending
    const res = await page.request.get("/api/reservations");
    const all = (await res.json()) as Array<{ id: number; status: string }>;
    const mine = all.find((r) => r.id === reservationId);
    expect(mine?.status).toBe("pending");
  });
});
