// lib/__tests__/session_epoch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpError } from "../api";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = {
  authenticated: true,
  personId: 1,
  isAdmin: true,
  epoch: 0 as number | undefined,
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetSessionEpoch = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  getSessionEpoch: (...a: unknown[]) => mockGetSessionEpoch(...a),
  isOwner: vi.fn(() => false),
  isActivePerson: vi.fn(() => true),
}));

import { requireAdmin } from "../api";

const req = new Request("http://localhost/api/anything");

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = true;
  mockSession.epoch = 0;
});

describe("session epoch revocation", () => {
  it("allows the session when the epoch matches the stored value", async () => {
    mockGetSessionEpoch.mockReturnValue(0);
    await expect(requireAdmin(req)).resolves.toBe(mockSession);
  });

  it("rejects the session (403) when the epoch is stale", async () => {
    mockGetSessionEpoch.mockReturnValue(1); // user did "log out everywhere"
    await expect(requireAdmin(req)).rejects.toBeInstanceOf(HttpError);
    await expect(requireAdmin(req)).rejects.toMatchObject({ status: 403 });
  });

  it("skips the epoch check for legacy cookies without an epoch", async () => {
    mockSession.epoch = undefined;
    await expect(requireAdmin(req)).resolves.toBe(mockSession);
    expect(mockGetSessionEpoch).not.toHaveBeenCalled();
  });
});
