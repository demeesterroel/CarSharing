import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi, scrollToLoadAll } from "./helpers";

/**
 * Members (people) deactivate e2e tests.
 *
 * No DELETE endpoint exists — deactivation is done via PUT with active=0.
 *
 * Strategy:
 * - Admin creates a person via API in beforeEach with a unique per-test name
 *   (timestamp suffix) so tests that run sequentially never see each other's
 *   rows in the people list.
 * - Deactivate via PUT (active=0), verify presence in the inactive section on /admin/members.
 * - Reactivate in afterEach (active=1) to avoid low-contrast a11y failures on
 *   /admin/members.  No DELETE endpoint exists, so the row remains — but
 *   globalSetup reseeds data/e2e.db before every run, so no row accumulates
 *   across runs.
 *
 * Cleanup guarantee: globalSetup (see playwright.config.ts) seeds a fresh
 * data/e2e.db on every `npx playwright test` invocation, so stale E2E* rows
 * from a previous run are never present when tests start.
 */

const FIRST_NAME_PREFIX = "E2ETest";
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
  // Unique suffix per test so the /admin/members list can identify this specific row.
  let uniqueFirstName: string;

  function buildPersonData(firstName: string) {
    return {
      first_name: firstName,
      last_name: LAST_NAME,
      discount: 0,
      discount_long: 0,
      active: 1 as const,
      bank_account: "",
    };
  }

  test.beforeEach(async ({ request }, testInfo) => {
    // Make the name unique per test (index + title hash) so the /admin/members list
    // never shows a sibling test's member when we assert visibility.
    uniqueFirstName = `${FIRST_NAME_PREFIX}${testInfo.workerIndex}${Date.now()}`;

    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);
    personData = buildPersonData(uniqueFirstName);

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

  test("new member appears in the admin members list", async ({ page }) => {
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    await expect(page.locator(`text=${uniqueFirstName}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("deactivated member shows in the inactive section on admin members", async ({ page }) => {
    // Deactivate via API.
    await api.put<{ ok: boolean }>(`/api/people/${personId}`, {
      ...personData,
      active: 0,
    });

    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    // The inactive ("Anderen") section is shown and the member is listed under it.
    // fullNameOf() uppercases the last name, so match accordingly.
    await expect(page.getByText("Anderen", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`${uniqueFirstName} ${LAST_NAME.toUpperCase()}`, { exact: true })).toBeVisible();
  });

  test("deactivated member still retrievable via API", async () => {
    await api.put<{ ok: boolean }>(`/api/people/${personId}`, {
      ...personData,
      active: 0,
    });

    const person = await api.get<PersonRow>(`/api/people/${personId}`);
    expect(person.active).toBe(0);
    expect(person.first_name).toBe(uniqueFirstName);
  });
});

test.describe("members add via FAB", () => {
  test("admin creates a member from the /admin/members FAB", async ({ page }) => {
    const firstName = `E2EFab${Date.now()}`;
    const lastName = "Member";

    // Authenticate the page context.
    await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin" },
    });

    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");

    // Open the add-member sheet via the FAB (nl aria-label).
    await page.getByRole("button", { name: "Persoon toevoegen" }).click();

    // Fill the form (inputs targeted by name attribute — locale-independent).
    await page.locator('input[name="first_name"]').fill(firstName);
    await page.locator('input[name="last_name"]').fill(lastName);

    // Submit.
    await page.locator('button[type="submit"]').click();

    // New member appears in the active list.
    await expect(page.getByText(`${firstName} ${lastName}`).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("members invite link", () => {
  test("invite link activates on username entry and persists before inviting", async ({
    page,
  }) => {
    const firstName = `E2EInvite${Date.now()}`;
    const lastName = "Member";

    // Create a member WITHOUT a username via the admin API.
    const session = await loginAndGetSession(page.request, "admin", "admin");
    const api = makeApi(page.request, session.csrf);
    const { id } = await api.post<{ id: number }>("/api/people", {
      first_name: firstName,
      last_name: lastName,
      discount: 0,
      discount_long: 0,
      active: 1,
      bank_account: "",
    });

    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");
    await scrollToLoadAll(page);

    // Expand the member's row (fullNameOf uppercases the last name).
    await page.getByText(`${firstName} ${lastName.toUpperCase()}`, { exact: true }).click();

    // No saved username yet → invite button disabled.
    const inviteBtn = page.getByRole("button", { name: "Kopieer uitnodigingslink" });
    await expect(inviteBtn).toBeDisabled();

    // Typing a username enables the invite button (even before saving).
    const newUsername = `e2elogin${Date.now()}`;
    await page.getByPlaceholder("Nog geen login").fill(newUsername);
    await expect(inviteBtn).toBeEnabled();

    // Clicking saves the form first (persisting the username), then invites.
    await inviteBtn.click();

    // The username is persisted as a direct result of the click — proving the
    // save-before-invite behaviour (the invite endpoint 400s otherwise). Poll
    // because the save fires asynchronously from the click handler.
    await expect
      .poll(
        async () => (await api.get<{ username: string | null }>(`/api/people/${id}`)).username,
        { timeout: 10_000 }
      )
      .toBe(newUsername);
  });
});
