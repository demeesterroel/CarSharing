import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

// The me route calls getDb().prepare(...).get() directly for person fields.
// We need a chainable mock: getDb() → { prepare: () => { get: () => row } }
const mockPrepareGet = vi.fn();
const mockDb = {
  prepare: vi.fn(() => ({ get: mockPrepareGet })),
};
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mockDb) }));

const mockSession: Record<string, unknown> = {
  authenticated: true,
  personId: 1,
  isAdmin: false,
  shortName: "Alice",
  epoch: undefined,
  cloakedAs: undefined,
  destroy: vi.fn(),
  save: vi.fn(),
};
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

const mockIsActivePerson = vi.fn();
const mockIsOwner = vi.fn();
const mockGetSessionEpoch = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: (...a: unknown[]) => mockIsActivePerson(...a),
  isOwner: (...a: unknown[]) => mockIsOwner(...a),
  getSessionEpoch: (...a: unknown[]) => mockGetSessionEpoch(...a),
  shortNameOf: (row: { first_name: string; last_name: string; username: string | null }) =>
    row.username ?? row.first_name,
}));

let mailEnabled = true;
vi.mock("@/lib/mailer", () => ({
  isMailEnabled: () => mailEnabled,
}));

vi.mock("@/lib/csrf", () => ({
  generateCsrfToken: vi.fn(() => "mock-csrf-token"),
}));

import { GET } from "./route";

const personRow = {
  first_name: "Alice",
  last_name: "",
  username: "alice",
  theme_preference: "mono",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockSession.shortName = "Alice";
  mockSession.epoch = undefined;
  mockSession.cloakedAs = undefined;
  mailEnabled = true;
  mockIsActivePerson.mockReturnValue(true);
  mockIsOwner.mockReturnValue(false);
  mockGetSessionEpoch.mockReturnValue(0);
  // Default: return a person row for the inline DB prepare call
  mockPrepareGet.mockReturnValue(personRow);
});

describe("GET /api/me", () => {
  it("returns null when unauthenticated", async () => {
    mockSession.authenticated = false;
    mockSession.personId = undefined;
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
    // CSRF cookie should still be set
    expect(res.headers.get("set-cookie")).toContain("csrf-token");
  });

  it("returns identity object with mailEnabled when authenticated", async () => {
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      personId: 1,
      isAdmin: false,
      isOwner: false,
      isCloaked: false,
      mailEnabled: true,
    });
    expect(body).toHaveProperty("shortName");
    expect(body).toHaveProperty("themePreference");
    expect(res.headers.get("set-cookie")).toContain("csrf-token");
  });

  it("reflects mailEnabled=false when mailer is not configured", async () => {
    mailEnabled = false;
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mailEnabled).toBe(false);
  });

  it("reflects isAdmin=true when session has admin flag", async () => {
    mockSession.isAdmin = true;
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });

  it("reflects isOwner=true when the person is a car owner", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isOwner).toBe(true);
  });

  it("destroys phantom session (authenticated but person inactive) and returns null", async () => {
    mockIsActivePerson.mockReturnValue(false);
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
    expect(mockSession.destroy).toHaveBeenCalledOnce();
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("destroys session on epoch mismatch and returns null", async () => {
    mockSession.epoch = 5;
    mockSession.personId = 1;
    // DB epoch is different from cookie epoch → revoked
    mockGetSessionEpoch.mockReturnValue(99);
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
    expect(mockSession.destroy).toHaveBeenCalledOnce();
    // The destroyed cookie must actually be persisted to the response, or the
    // client keeps a "valid" cookie and the Edge proxy never logs it out (#284).
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("returns identity when epoch matches", async () => {
    mockSession.epoch = 3;
    mockSession.personId = 1;
    mockGetSessionEpoch.mockReturnValue(3);
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
    expect(body.personId).toBe(1);
    expect(mockSession.destroy).not.toHaveBeenCalled();
  });

  // #333: the csrf token must be stable (issued once, reused) — not rotated on
  // every call, which raced with refetch-on-focus and broke save with invalid_csrf.
  it("issues a csrf-token cookie when the request has none", async () => {
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.cookies.get("csrf-token")?.value).toBe("mock-csrf-token");
  });

  it("does NOT rotate the csrf-token when the request already has one", async () => {
    const res = await GET(
      new Request("http://localhost/api/me", { headers: { cookie: "csrf-token=existing-abc" } })
    );
    expect(res.cookies.get("csrf-token")).toBeUndefined();
  });
});
