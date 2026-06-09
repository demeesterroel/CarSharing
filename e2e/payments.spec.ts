import { expect, test } from "@playwright/test";
import { getTestEntities, loginAndGetCsrf, loginAndGetSession, makeApi } from "./helpers";

/**
 * Payments update + delete e2e tests.
 *
 * The payments list (C+R) is already covered by cache-invalidation.spec.ts.
 * This file covers the missing U and D operations.
 *
 * Strategy:
 * - Create a payment via API in beforeEach.
 * - Update amount via PUT, verify via GET.
 * - Delete via API in afterEach.
 */

const TODAY = new Date().toISOString().slice(0, 10);
const AMOUNT_ORIGINAL = 50;
const AMOUNT_UPDATED = 75;

test.describe("payments update + delete", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let paymentId: number;
  let personId: number;

  test.beforeEach(async ({ request }) => {
    // Payments require admin — login as admin so POST/PUT/DELETE are permitted.
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const entities = await getTestEntities(api);
    personId = session.personId ?? entities.personId;

    const res = await api.post<{ id: number }>("/api/payments", {
      person_id: personId,
      date: TODAY,
      amount: AMOUNT_ORIGINAL,
    });
    paymentId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!paymentId) return;
    try {
      const cleanupCsrf = await loginAndGetCsrf(request, "admin", "admin");
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.delete(`/api/payments/${paymentId}`);
    } catch {
      // Ignore — payment already deleted
    }
  });

  test("payment amount updates via PUT", async ({ request }) => {
    await api.put<{ ok: boolean }>(`/api/payments/${paymentId}`, {
      person_id: personId,
      date: TODAY,
      amount: AMOUNT_UPDATED,
    });

    const updated = await api.get<{ id: number; amount: number }>(`/api/payments/${paymentId}`);
    expect(updated.amount).toBe(AMOUNT_UPDATED);
  });

  test("payment is deleted via DELETE", async ({ request }) => {
    const deletedId = paymentId;
    await api.delete(`/api/payments/${deletedId}`);
    paymentId = 0;

    const res = await request.get(`/api/payments/${deletedId}`);
    // After deletion the record is gone — expect 404
    expect(res.status()).toBe(404);
  });
});
