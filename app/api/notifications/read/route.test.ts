// app/api/notifications/read/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = {
  authenticated: true,
  personId: 1,
  isAdmin: false,
  save: vi.fn(),
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/queries/people", () => ({ isActivePerson: vi.fn(() => true) }));

const mockMarkRead = vi.fn();
vi.mock("@/lib/queries/notifications", () => ({
  markRead: (...a: unknown[]) => mockMarkRead(...a),
}));

import { POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ipCounter = 0;
function postReq(body: unknown, withCsrf = true) {
  return new Request("http://localhost/api/notifications/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {}),
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
});

describe("POST /api/notifications/read", () => {
  it("marks all notifications read when no ids provided", async () => {
    mockSession.personId = 3;
    const res = await POST(postReq({}), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockMarkRead).toHaveBeenCalledWith({}, 3, undefined);
  });

  it("marks specific notifications read and scopes to session person", async () => {
    mockSession.personId = 4;
    const res = await POST(postReq({ ids: [10, 11, 12] }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockMarkRead).toHaveBeenCalledWith({}, 4, [10, 11, 12]);
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await POST(postReq({}), ctx);
    expect(res.status).toBe(403);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const res = await POST(postReq({}, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body (ids contains non-integer)", async () => {
    const res = await POST(postReq({ ids: ["not-a-number"] }), ctx);
    expect(res.status).toBe(400);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });
});
