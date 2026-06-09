// app/api/auth/cloak/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession: Record<string, unknown> = {
  authenticated: true,
  isAdmin: true,
  cloakedAs: undefined,
  save: vi.fn(),
};

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetPersonById = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  getPersonById: (...args: unknown[]) => mockGetPersonById(...args),
  shortNameOf: (p: { first_name?: string }) => p.first_name ?? "Person",
  isOwner: () => true,
}));

function makeReq(body: unknown) {
  return new Request("http://localhost/api/auth/cloak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.isAdmin = true;
  mockSession.cloakedAs = undefined;
  mockSession.save = vi.fn();
  mockGetPersonById.mockReturnValue({ id: 5, first_name: "Alice", active: 1, is_admin: 0 });
});

describe("POST /api/auth/cloak", () => {
  it("sets cloakedAs and returns 200 for admin with valid target", async () => {
    const res = await POST(makeReq({ personId: 5 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSession.cloakedAs).toMatchObject({ personId: 5, shortName: "Alice", isOwner: true });
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("returns 403 when not admin", async () => {
    mockSession.isAdmin = false;
    const res = await POST(makeReq({ personId: 5 }));
    expect(res.status).toBe(403);
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("returns 403 when not authenticated", async () => {
    mockSession.authenticated = false;
    mockSession.isAdmin = false;
    const res = await POST(makeReq({ personId: 5 }));
    expect(res.status).toBe(403);
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("returns 400 for missing personId", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric personId", async () => {
    const res = await POST(makeReq({ personId: "five" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/auth/cloak", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when person not found", async () => {
    mockGetPersonById.mockReturnValue(undefined);
    const res = await POST(makeReq({ personId: 99 }));
    expect(res.status).toBe(404);
  });

  it("returns 404 for inactive person", async () => {
    mockGetPersonById.mockReturnValue({ id: 5, first_name: "Alice", active: 0, is_admin: 0 });
    const res = await POST(makeReq({ personId: 5 }));
    expect(res.status).toBe(404);
  });
});
