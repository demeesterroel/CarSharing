/**
 * E2E regression tests for React Query cache invalidation bugs.
 *
 * #193 — New reservation not visible after save without page refresh
 * #176 — New payment not visible after save without page refresh
 *
 * Both tests go through the real UI form, assert the item appears in the list
 * immediately after the success toast fires, and never call page.reload().
 * They FAIL when the bug is present and PASS when fixed.
 *
 * Requires demo.db seed data: start server with DB_PATH=data/demo.db.
 * Seed accounts: admin/admin (is_admin=1), owner/owner, alice/alice, bob/bob.
 */

import { test, expect } from "@playwright/test";
import { loginAndGetCsrf, makeApi } from "./helpers";

// demo.db admin credentials
const EMAIL = process.env.TEST_EMAIL ?? "admin";
const PASSWORD = process.env.TEST_PASSWORD ?? "admin";

async function loginViaApi(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  // Trigger /api/me so the csrf-token cookie is written.
  await page.request.get("/api/me");
}

/** Dismiss the Next.js dev hydration-error overlay if it is open. */
async function dismissDevOverlay(page: import("@playwright/test").Page) {
  const closeBtn = page.locator("[data-nextjs-dialog-header] button").first();
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click();
  }
}

// ─── #193 – reservation appears immediately after save ────────────────────────

test.describe("issue #193 – reservation cache invalidation", () => {
  let reservationId: number | null = null;

  test.afterEach(async ({ request }) => {
    if (!reservationId) return;
    try {
      const csrf = await loginAndGetCsrf(request, EMAIL, PASSWORD);
      await makeApi(request, csrf).delete(`/api/reservations/${reservationId}`);
    } catch {
      // best-effort cleanup
    }
    reservationId = null;
  });

  test("new reservation appears in list without page refresh", async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Open add-reservation sheet via the FAB (aria-label exact match).
    await page.getByRole("button", { name: /^(add reservation|reservering toevoegen)$/i }).click();
    await page.waitForURL(/action=add/);
    await dismissDevOverlay(page);

    // Scope all form interactions to the <form> element inside the BottomSheet.
    const form = page.locator("form");

    // Wait for the CarToggle to render inside the form.
    // Car BB has no seed reservations this week — avoids date conflicts.
    // In mono theme, CarToggle shows car.name only ("Car BB"); in paper theme it shows "BB\nCar BB".
    await expect(form.getByRole("button", { name: /car bb/i })).toBeVisible({ timeout: 8_000 });
    await form.getByRole("button", { name: /car bb/i }).click();

    // No calendar navigation — use the current 14-day window (Mon of this week → Sun next).
    // Grid cells are direct children of the repeat(7, 1fr) grid div inside the form.
    // Cell 0 = Monday (start), cell 6 = Sunday (end).
    const gridCells = form.locator('div[style*="repeat(7, 1fr)"] > div');
    await gridCells.nth(0).click();
    await gridCells.nth(6).click();

    // Admin user: select first person from the driver <select>.
    const driverSelect = form.locator("select").first();
    const firstOption = driverSelect.locator("option:not([disabled])").first();
    const firstVal = await firstOption.getAttribute("value");
    if (firstVal) await driverSelect.selectOption(firstVal);

    // Note — unique sentinel.
    const NOTE = `E2E-cache-res-${Date.now()}`;
    await form.locator("input[placeholder*='weekend' i], input[placeholder*='reden' i]").fill(NOTE);

    // Arm response interceptor before submit.
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/reservations") && r.request().method() === "POST"
    );

    // Submit.
    await form
      .getByRole("button", { name: /confirm reservation|request reservation|bevestig|aanvraag|opslaan|save/i })
      .click();

    const apiRes = await responsePromise;
    if (apiRes.ok()) {
      const body = await apiRes.json().catch(() => null);
      if (body?.id) reservationId = body.id;
    }

    // Wait for the success toast — at this point sheet is closed, URL back to /calendar.
    await expect(page.locator("text=/reservation saved|reservering opgeslagen/i")).toBeVisible({
      timeout: 10_000,
    });

    // ── Core assertion: item must appear WITHOUT page.reload() ───────────────
    await expect(page.locator(`text=${NOTE}`)).toBeVisible({ timeout: 8_000 });
  });
});

// ─── #176 – payment appears immediately after save ────────────────────────────

test.describe("issue #176 – payment cache invalidation", () => {
  let paymentId: number | null = null;

  test.afterEach(async ({ request }) => {
    if (!paymentId) return;
    try {
      const csrf = await loginAndGetCsrf(request, EMAIL, PASSWORD);
      await makeApi(request, csrf).delete(`/api/payments/${paymentId}`);
    } catch {
      // best-effort cleanup
    }
    paymentId = null;
  });

  test("new payment appears in list without page refresh", async ({ page }) => {
    await loginViaApi(page);
    // Payments are managed at /admin/payments (no standalone /payments page).
    await page.goto("/admin/payments");
    await page.waitForLoadState("networkidle");
    await dismissDevOverlay(page);

    // Click the "+ Toevoegen" / "+ Add" button to open the inline add form.
    await page.getByRole("button", { name: /^\+\s*(toevoegen|add)$/i }).click();

    // Wait for the inline add form to appear ("Betaling toevoegen" heading).
    await expect(page.getByText(/betaling toevoegen|add payment/i)).toBeVisible({ timeout: 3_000 });

    // Select the first real person (index 1 skips the disabled placeholder at index 0).
    // The page has 2 filter selects before the form person select (index 2).
    const personSel = page.locator("select").nth(2);
    await personSel.selectOption({ index: 1 });

    // Amount.
    await page.locator("input[type='number']").fill("42");

    // Note — unique sentinel.
    const NOTE = `E2E-cache-pay-${Date.now()}`;
    await page.locator("input[type='text']").fill(NOTE);

    // Arm response interceptor.
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/payments") && r.request().method() === "POST"
    );

    // Submit with the save button inside the add form.
    await page.getByRole("button", { name: /^(opslaan|save)$/i }).click();

    const apiRes = await responsePromise;
    if (apiRes.ok()) {
      const body = await apiRes.json().catch(() => null);
      if (body?.id) paymentId = body.id;
    }

    // ── Core assertion: note must appear in the list WITHOUT page.reload() ──
    await expect(page.getByText(NOTE)).toBeVisible({ timeout: 8_000 });
  });
});
