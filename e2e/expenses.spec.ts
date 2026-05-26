import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi, getTestEntities, scrollToLoadAll } from "./helpers";

/**
 * Expense CRUD + dashboard delta tests.
 *
 * Strategy:
 * - Create an expense via the API in beforeEach (data isolation).
 * - Assert it appears in the /expenses list UI.
 * - Verify the dashboard expense_count and expense_amount delta.
 * - Delete via the API in afterEach (cleanup).
 */

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

const DESCRIPTION = "E2E-Test-Expense-Description";
const AMOUNT = 123.45;

test.describe("expense CRUD", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let expenseId: number;
  let personId: number;
  let carId: number;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request);
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const entities = await getTestEntities(api);
    personId = session.personId ?? entities.personId;
    carId = entities.carId;

    const res = await api.post<{ id: number }>("/api/expenses", {
      person_id: personId,
      car_id: carId,
      date: TODAY,
      amount: AMOUNT,
      description: DESCRIPTION,
      category: "onderhoud",
    });
    expenseId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!expenseId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request);
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/expenses/${expenseId}`);
    } catch {
      // Ignore — expense already deleted
    }
  });

  test("expense appears in the expenses list after creation", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });

    await page.goto("/expenses");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    // ExpenseCard renders: {description} as primary text
    await expect(page.locator(`text=${DESCRIPTION}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard expense_amount increases by the expense amount", async ({ request }) => {
    const dashWithExpense = await api.get<Array<{
      person_id: number;
      expense_count: number;
      expense_amount: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWith = dashWithExpense.find((r) => r.person_id === personId);
    const amountWithExpense = rowWith?.expense_amount ?? 0;
    const countWithExpense = rowWith?.expense_count ?? 0;

    // Delete and compare
    await api.delete(`/api/expenses/${expenseId}`);
    expenseId = 0;

    const dashWithout = await api.get<Array<{
      person_id: number;
      expense_count: number;
      expense_amount: number;
    }>>(`/api/dashboard?year=${YEAR}`);

    const rowWithout = dashWithout.find((r) => r.person_id === personId);
    const amountWithout = rowWithout?.expense_amount ?? 0;
    const countWithout = rowWithout?.expense_count ?? 0;

    expect(amountWithExpense - amountWithout).toBeCloseTo(AMOUNT, 2);
    expect(countWithExpense - countWithout).toBe(1);
  });

  test("expense disappears from the list after deletion", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: {
        username: process.env.TEST_EMAIL ?? "alice",
        password: process.env.TEST_PASSWORD ?? "alice",
      },
    });

    await page.goto("/expenses");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${DESCRIPTION}`).first()).toBeVisible({ timeout: 10_000 });

    await api.delete(`/api/expenses/${expenseId}`);
    expenseId = 0;

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(DESCRIPTION, { exact: true })).toHaveCount(0);
  });
});
