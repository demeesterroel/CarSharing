// app/api/people/[id]/revoke-sessions/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockBump = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  bumpSessionEpoch: (...a: unknown[]) => mockBump(...a),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

// Keep the real json() wrapper + HttpError; override only requireAdmin.
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) };
});

import { HttpError } from "@/lib/api";
import { POST } from "./route";

const CSRF = "test-csrf-token";
function req(withCsrf = true) {
  return new Request("http://localhost/api/people/7/revoke-sessions", {
    method: "POST",
    headers: withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {},
  });
}
const ctx = { params: Promise.resolve({ id: "7" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ isAdmin: true, personId: 1 });
});

describe("POST /api/people/[id]/revoke-sessions", () => {
  it("bumps the target member's session epoch", async () => {
    const res = await POST(req() as never, ctx as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(mockBump).toHaveBeenCalledWith({}, 7);
  });

  it("rejects a non-admin caller with 403", async () => {
    mockRequireAdmin.mockImplementation(() => {
      throw new HttpError(403, "Forbidden");
    });
    const res = await POST(req() as never, ctx as never);
    expect(res.status).toBe(403);
    expect(mockBump).not.toHaveBeenCalled();
  });

  it("rejects when the CSRF token is missing", async () => {
    const res = await POST(req(false) as never, ctx as never);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockBump).not.toHaveBeenCalled();
  });
});
