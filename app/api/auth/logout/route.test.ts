// app/api/auth/logout/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = {
  authenticated: true,
  save: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

function makeReq() {
  return new Request("http://localhost/api/auth/logout", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
});

describe("POST /api/auth/logout", () => {
  it("destroys session and returns 200 when authenticated", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSession.destroy).toHaveBeenCalledOnce();
  });

  it("returns 200 but skips destroy when not authenticated", async () => {
    mockSession.authenticated = false;
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockSession.destroy).not.toHaveBeenCalled();
  });
});
