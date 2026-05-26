import { test, expect } from "@playwright/test";
import { loginAndGetCsrf, makeApi, getTestEntities } from "./helpers";

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
const FUTURE_END = new Date(Date.now() + 62 * 86400_000).toISOString().slice(0, 10);   // +62 days

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

      // Click the "Bevestigen" / "Confirm" button that sits next to our card.
      // The confirm button text comes from t("admin.confirm") → "Bevestigen" (nl) / "Confirm" (en).
      // There may be multiple pending reservations; click the first confirm button
      // (our reservation was just inserted so it should be at the top).
      const confirmBtn = adminPage
        .getByRole("button", { name: /bevestigen|confirm/i })
        .first();
      await confirmBtn.click();

      // After confirmation a toast appears and the card disappears from the inbox
      // (or the list refreshes). Wait for the reservation to no longer be "pending"
      // in the inbox by checking the API.
      await adminPage.waitForTimeout(1000); // let the mutation settle

      const reservationsAfter = await adminPage.request.get("/api/reservations");
      const all = await reservationsAfter.json() as Array<{
        id: number;
        status: string;
      }>;
      const updated = all.find((r) => r.id === reservationId);
      expect(updated?.status).toBe("confirmed");
    } finally {
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
    const all = await res.json() as Array<{ id: number; status: string }>;
    const mine = all.find((r) => r.id === reservationId);
    expect(mine?.status).toBe("pending");
  });
});
