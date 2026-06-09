// app/api/notifications/unread-count/route.test.ts
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

const mockUnreadCount = vi.fn((..._a: unknown[]) => 3);
vi.mock("@/lib/queries/notifications", () => ({
  unreadCount: (...a: unknown[]) => mockUnreadCount(...a),
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };

function getReq() {
  return new Request("http://localhost/api/notifications/unread-count");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockUnreadCount.mockReturnValue(3);
});

describe("GET /api/notifications/unread-count", () => {
  it("returns the unread count scoped to the session person", async () => {
    mockSession.personId = 7;
    mockUnreadCount.mockReturnValue(5);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 5 });
    expect(mockUnreadCount).toHaveBeenCalledWith({}, 7);
  });

  it("returns 403 for an unauthenticated request (no personId)", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockUnreadCount).not.toHaveBeenCalled();
  });
});
