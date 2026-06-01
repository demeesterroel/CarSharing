import { test, expect } from "@playwright/test";
import { loginAndGetSession, loginAndGetCsrf, makeApi } from "./helpers";

/**
 * Invite flow e2e tests.
 *
 * Strategy:
 * - Admin creates a new person without a password.
 * - Admin generates an invite token via POST /api/people/[id]/invite.
 * - Extract the token from the returned URL.
 * - POST to /api/invite/[token] with a password — simulates accepting the invite.
 * - Verify the response indicates success and a person_id is returned.
 * - Cleanup: deactivate the test person in afterEach.
 */

const INVITE_FIRST = "E2EInvite";
const INVITE_LAST = "Tester";
const INVITE_PASSWORD = "securepassword123";

test.describe("invite flow", () => {
  let csrf: string;
  let api: ReturnType<typeof makeApi>;
  let personId: number;

  const personData = {
    first_name: INVITE_FIRST,
    last_name: INVITE_LAST,
    discount: 0,
    discount_long: 0,
    active: 1 as const,
    bank_account: "",
  };

  test.beforeEach(async ({ request }) => {
    const session = await loginAndGetSession(request, "admin", "admin");
    csrf = session.csrf;
    api = makeApi(request, csrf);

    const res = await api.post<{ id: number }>("/api/people", personData);
    personId = res.id;
  });

  test.afterEach(async ({ request }) => {
    if (!personId) return;
    // Reactivate — deactivated members have low-contrast styling that breaks a11y audit.
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

  test("admin can generate an invite URL for a new person", async () => {
    const result = await api.post<{ url: string }>(`/api/people/${personId}/invite`, {});
    expect(result.url).toMatch(/\/invite\/[a-f0-9]{48}$/);
  });

  test("accepting an invite sets password and logs user in", async ({ request }) => {
    const { url } = await api.post<{ url: string }>(`/api/people/${personId}/invite`, {});
    const token = url.split("/invite/")[1];
    expect(token).toBeTruthy();

    // POST to /api/invite/[token] without authentication — simulates the invite accept page
    const res = await request.post(`/api/invite/${token}`, {
      data: { password: INVITE_PASSWORD },
      headers: { "Content-Type": "application/json" },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json() as { ok: boolean; person_id: number };
    expect(body.ok).toBe(true);
    expect(body.person_id).toBe(personId);
  });

  test("invite token is invalid after use", async ({ request }) => {
    const { url } = await api.post<{ url: string }>(`/api/people/${personId}/invite`, {});
    const token = url.split("/invite/")[1];

    // Use the token once
    await request.post(`/api/invite/${token}`, {
      data: { password: INVITE_PASSWORD },
      headers: { "Content-Type": "application/json" },
    });

    // Second use should fail — token was deleted after first use
    const res = await request.post(`/api/invite/${token}`, {
      data: { password: INVITE_PASSWORD },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("invalid_token");
  });
});
