import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));

// The route uses db.transaction(...)(args) — mock it so the callback is run inline.
const mockSetPasswordHash = vi.fn();
const mockDeleteInviteToken = vi.fn();
const mockTransactionFn = vi.fn((cb: (args: unknown) => void) => (args: unknown) => cb(args));
const mockDb = {
  transaction: mockTransactionFn,
};
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mockDb) }));

const mockGetInviteToken = vi.fn();
const mockGetPersonById = vi.fn();
const mockGetSessionEpoch = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  getInviteToken: (...a: unknown[]) => mockGetInviteToken(...a),
  deleteInviteToken: (...a: unknown[]) => mockDeleteInviteToken(...a),
  setPasswordHash: (...a: unknown[]) => mockSetPasswordHash(...a),
  getPersonById: (...a: unknown[]) => mockGetPersonById(...a),
  getSessionEpoch: (...a: unknown[]) => mockGetSessionEpoch(...a),
  shortNameOf: (p: { first_name: string; username: string | null }) => p.username ?? p.first_name,
}));

const mockSession = { save: vi.fn(), authenticated: false, personId: 0, isAdmin: false };
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

import { POST } from "./route";

function makeCtx(token: string) {
  return { params: Promise.resolve({ token }) };
}

function req(body: unknown, token = "valid-token-abc") {
  return new Request(`http://localhost/api/invite/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A token that expires far in the future
const validTokenRecord = {
  token: "valid-token-abc",
  person_id: 7,
  expires_at: new Date(Date.now() + 86400_000).toISOString(),
};

const fakePerson = {
  id: 7,
  first_name: "Bob",
  last_name: "",
  username: "bob",
  is_admin: 0,
  active: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInviteToken.mockReturnValue(validTokenRecord);
  mockGetPersonById.mockReturnValue(fakePerson);
  mockGetSessionEpoch.mockReturnValue(1);
  mockSession.save.mockResolvedValue(undefined);
});

describe("POST /api/invite/[token]", () => {
  it("accepts a valid token + strong password and returns ok with person_id", async () => {
    const res = await POST(req({ password: "strongpassword123" }), makeCtx("valid-token-abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, person_id: 7 });
    // Password hash should have been set
    expect(mockSetPasswordHash).toHaveBeenCalledOnce();
    // Token should be deleted after use
    expect(mockDeleteInviteToken).toHaveBeenCalled();
    // Session should be saved (logged in automatically)
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("returns 400 when password is too short (< 8 chars)", async () => {
    const res = await POST(req({ password: "short" }), makeCtx("valid-token-abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "bad_request" });
    expect(mockSetPasswordHash).not.toHaveBeenCalled();
  });

  it("returns 400 when password field is missing", async () => {
    const res = await POST(req({}), makeCtx("valid-token-abc"));
    expect(res.status).toBe(400);
    expect(mockSetPasswordHash).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid/unknown token", async () => {
    mockGetInviteToken.mockReturnValue(null);
    const res = await POST(req({ password: "strongpassword123" }), makeCtx("unknown-token"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "invalid_token" });
    expect(mockSetPasswordHash).not.toHaveBeenCalled();
  });

  it("returns 400 for an expired token and deletes it", async () => {
    mockGetInviteToken.mockReturnValue({
      ...validTokenRecord,
      expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    });
    const res = await POST(req({ password: "strongpassword123" }), makeCtx("valid-token-abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "token_expired" });
    // Expired token must be cleaned up
    expect(mockDeleteInviteToken).toHaveBeenCalledOnce();
    expect(mockSetPasswordHash).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
    const badReq = new Request("http://localhost/api/invite/valid-token-abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(badReq, makeCtx("valid-token-abc"));
    expect(res.status).toBe(400);
  });
});
