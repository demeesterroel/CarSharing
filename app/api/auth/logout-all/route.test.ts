// app/api/auth/logout-all/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = {
  authenticated: true,
  personId: 5,
  destroy: vi.fn(),
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockBump = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  bumpSessionEpoch: (...a: unknown[]) => mockBump(...a),
}));

import { POST } from "./route";

const CSRF = "test-csrf-token";
function req(withCsrf = true, withSession = true) {
  mockSession.authenticated = withSession;
  mockSession.personId = withSession ? 5 : (undefined as unknown as number);
  return new Request("http://localhost/api/auth/logout-all", {
    method: "POST",
    headers: withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.destroy = vi.fn();
});

describe("POST /api/auth/logout-all", () => {
  it("bumps the session epoch and destroys the current session", async () => {
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(mockBump).toHaveBeenCalledWith({}, 5);
    expect(mockSession.destroy).toHaveBeenCalledOnce();
  });

  it("rejects when the CSRF token is missing", async () => {
    const res = await POST(req(false) as never);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockBump).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    const res = await POST(req(true, false) as never);
    expect(res.status).toBe(403);
    expect(mockBump).not.toHaveBeenCalled();
  });
});
