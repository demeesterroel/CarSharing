import { expect, test } from "@playwright/test";
import { loginAndGetSession, makeApi } from "./helpers";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

/**
 * #179 — an admin cloaked as a car owner must keep the owner's access, including
 * the owner vehicles page (/admin/vehicles, which is part of OWNER_PAGES).
 *
 * Repro: log in as admin, cloak as the seeded non-admin car owner ("owner"),
 * then open /admin/vehicles. The Edge proxy currently blocks /admin/vehicles for
 * any cloaked non-admin and bounces to /admin — even though the cloaked person
 * is an owner who should see it.
 */
test.describe("cloak owner access (#179)", () => {
  test("admin cloaked as a car owner can open the owner vehicles page", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();

    // Authenticate the browser context as admin and grab a csrf token.
    const session = await loginAndGetSession(page.request, "admin", "admin");
    const api = makeApi(page.request, session.csrf);

    // The seeded "owner" account is a non-admin car owner — the exact case in #179.
    const people =
      await api.get<Array<{ id: number; username: string | null; is_admin: number }>>(
        "/api/people"
      );
    const owner = people.find((p) => p.username === "owner");
    test.skip(!owner, "Seed has no 'owner' account — needs demo seed data");
    expect(owner!.is_admin).toBe(0);

    // Cloak as that owner (admin-only; makeApi attaches the csrf header).
    await api.post("/api/auth/cloak", { personId: owner!.id });

    // The owner vehicles page must be reachable while cloaked.
    await page.goto("/admin/vehicles");
    await page.waitForLoadState("networkidle");

    // EXPECTED: still on /admin/vehicles. BUG today: the proxy bounces to /admin.
    expect(new URL(page.url()).pathname).toBe("/admin/vehicles");

    await ctx.close();
  });

  test("admin cloaked as a non-owner member is kept out of the owner/admin area", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();

    const session = await loginAndGetSession(page.request, "admin", "admin");
    const api = makeApi(page.request, session.csrf);

    // Pick a non-admin member who owns no car — they have no admin area at all.
    const people = await api.get<Array<{ id: number; is_admin: number }>>("/api/people");
    const cars = await api.get<Array<{ owner_person_id: number }>>("/api/vehicles");
    const ownerIds = new Set(cars.map((c) => c.owner_person_id));
    const member = people.find((p) => p.is_admin === 0 && !ownerIds.has(p.id));
    test.skip(!member, "Seed has no non-admin non-owner member");

    await api.post("/api/auth/cloak", { personId: member!.id });

    // Owner/admin pages must be off-limits to a cloaked plain member — including
    // /admin/settlement, which today renders its chrome instead of bouncing.
    await page.goto("/admin/settlement");
    await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15_000 });

    await ctx.close();
  });
});
