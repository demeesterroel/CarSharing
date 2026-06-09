// app/api/notifications/route.test.ts
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

const mockListNotifications = vi.fn((..._a: unknown[]) => [{ id: 1 }, { id: 2 }]);
vi.mock("@/lib/queries/notifications", () => ({
  listNotifications: (...a: unknown[]) => mockListNotifications(...a),
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };

function getReq() {
  return new Request("http://localhost/api/notifications");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockListNotifications.mockReturnValue([{ id: 1 }, { id: 2 }]);
});

describe("GET /api/notifications", () => {
  it("returns the notifications list scoped to the session person", async () => {
    mockSession.personId = 5;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockListNotifications).toHaveBeenCalledWith({}, 5);
  });

  it("returns 403 for an unauthenticated request (no personId)", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockListNotifications).not.toHaveBeenCalled();
  });
});
