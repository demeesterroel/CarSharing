import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi, scrollToLoadAll } from "./helpers";

/**
 * Members (people) deactivate e2e tests.
 *
 * No DELETE endpoint exists — deactivation is done via PUT with active=0.
 *
 * Strategy:
 * - Admin creates a person via API in beforeEach.
 * - Deactivate via PUT (active=0), verify absence from /people list.
 * - Reactivate in afterEach (active=1), then final delete not possible — we
 *   leave the inactive test person in place (demo.db only, not production).
 *
 * Cleanup: set active=0 is permanent for the test record since there is no
 * DELETE endpoint. Tests are run against demo.db which is reset between runs.
 */

const FIRST_NAME = "E2ETest";
const LAST_NAME = "Member";

type PersonRow = {
  id: number;
  first_name: string;
  last_name: string;
  active: number;
};

test.describe("members deactivate", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let personId: number;
  let personData: ReturnType<typeof buildPersonData>;

  function buildPersonData() {
    return {
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      discount: 0,
      discount_long: 0,
      active: 1 as const,
      bank_account: "",
    };
  }

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);
    personData = buildPersonData();

    const res = await api.post<{ id: number }>("/api/people", personData);
    personId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!personId) return;
    // Reactivate — deactivated members show with low-contrast styling on /admin/members
    // which breaks the a11y audit. Since there's no DELETE endpoint, restore active=1.
    try {
      const cleanupCsrf = await loginAndGetCsrf(request, "admin", "admin");
      const cleanupApi = makeApi(request, cleanupCsrf);
      await cleanupApi.put<{ ok: boolean }>(`/api/people/${personId}`, {
        ...personData,
        active: 1,
      });
    } catch {
      // Ignore
    }
  });

  test("new member appears in the people list", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/people");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${FIRST_NAME}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("deactivated member no longer appears in people list", async ({ page }) => {
    // Deactivate via API
    await api.put<{ ok: boolean }>(`/api/people/${personId}`, {
      ...personData,
      active: 0,
    });

    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/people");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    // Active members list should not show the deactivated test member
    await expect(page.getByText(`${FIRST_NAME} ${LAST_NAME}`, { exact: true })).toHaveCount(0);
  });

  test("deactivated member still retrievable via API", async () => {
    await api.put<{ ok: boolean }>(`/api/people/${personId}`, {
      ...personData,
      active: 0,
    });

    const person = await api.get<PersonRow>(`/api/people/${personId}`);
    expect(person.active).toBe(0);
    expect(person.first_name).toBe(FIRST_NAME);
  });
});
