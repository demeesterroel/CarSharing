// app/api/auth/uncloak/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession: Record<string, unknown> = {
  authenticated: true,
  cloakedAs: { personId: 2, shortName: "Bob", isAdmin: false },
  save: vi.fn(),
};

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

function makeReq() {
  return new Request("http://localhost/api/auth/uncloak", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.cloakedAs = { personId: 2, shortName: "Bob", isAdmin: false };
  mockSession.save = vi.fn();
});

describe("POST /api/auth/uncloak", () => {
  it("clears cloakedAs and saves session when authenticated", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSession.cloakedAs).toBeUndefined();
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("returns 401 when not authenticated", async () => {
    mockSession.authenticated = false;
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthenticated" });
    expect(mockSession.save).not.toHaveBeenCalled();
  });
});
