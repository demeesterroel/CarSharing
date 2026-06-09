import { expect, test } from "@playwright/test";
import { loginAndGetSession, makeApi } from "./helpers";

/**
 * Settlement lock / unlock e2e tests.
 *
 * Strategy:
 * - Admin POSTs to /api/settlement/[year] to toggle lock state.
 * - Verify frozen flag via GET response.
 * - Unlock in afterEach to restore clean state for the next run.
 *
 * Uses a year far in the past (2020) to avoid touching the current year's
 * real settlement data in demo.db.
 */

const TEST_YEAR = 2020;

test.describe("settlement lock / unlock", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let wasAlreadyFrozen: boolean;

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const current = await api.get<{ frozen: boolean }>(`/api/settlement/${TEST_YEAR}`);
    wasAlreadyFrozen = current.frozen;

    // Ensure we start from an unlocked state
    if (wasAlreadyFrozen) {
      await api.post<{ ok: boolean }>(`/api/settlement/${TEST_YEAR}`, {});
    }
  });

  test.afterEach(async () => {
    // Restore original lock state
    const current = await api.get<{ frozen: boolean }>(`/api/settlement/${TEST_YEAR}`);
    if (current.frozen !== wasAlreadyFrozen) {
      await api.post<{ ok: boolean }>(`/api/settlement/${TEST_YEAR}`, {});
    }
  });

  test("locking a settlement marks it frozen", async () => {
    // Lock
    await api.post<{ ok: boolean }>(`/api/settlement/${TEST_YEAR}`, {});

    const result = await api.get<{ frozen: boolean }>(`/api/settlement/${TEST_YEAR}`);
    expect(result.frozen).toBe(true);
  });

  test("unlocking a frozen settlement clears frozen flag", async () => {
    // Lock first
    await api.post<{ ok: boolean }>(`/api/settlement/${TEST_YEAR}`, {});

    // Unlock
    await api.post<{ ok: boolean }>(`/api/settlement/${TEST_YEAR}`, {});

    const result = await api.get<{ frozen: boolean }>(`/api/settlement/${TEST_YEAR}`);
    expect(result.frozen).toBe(false);
  });
});
