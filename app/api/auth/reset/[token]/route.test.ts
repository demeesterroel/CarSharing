// app/api/auth/reset/[token]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = { authenticated: false, personId: 0, save: vi.fn() };
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({ transaction: (fn: (a: unknown) => void) => (a: unknown) => fn(a) })),
}));

const mockGetAuthToken = vi.fn<(...a: unknown[]) => unknown>();
const mockDeleteAuthToken = vi.fn<(...a: unknown[]) => unknown>();
const mockSetPasswordHash = vi.fn<(...a: unknown[]) => unknown>();
const mockBumpSessionEpoch = vi.fn<(...a: unknown[]) => unknown>();
const mockGetSessionEpoch = vi.fn<(...a: unknown[]) => number>(() => 1);
const mockGetPersonById = vi.fn<(...a: unknown[]) => unknown>(() => ({
  id: 9,
  first_name: "Alice",
  is_admin: 0,
}));
vi.mock("@/lib/queries/people", () => ({
  getAuthToken: (...a: unknown[]) => mockGetAuthToken(...a),
  deleteAuthToken: (...a: unknown[]) => mockDeleteAuthToken(...a),
  setPasswordHash: (...a: unknown[]) => mockSetPasswordHash(...a),
  bumpSessionEpoch: (...a: unknown[]) => mockBumpSessionEpoch(...a),
  getSessionEpoch: (...a: unknown[]) => mockGetSessionEpoch(...a),
  getPersonById: (...a: unknown[]) => mockGetPersonById(...a),
  shortNameOf: (p: { first_name?: string }) => p.first_name ?? "Person",
}));

import { POST } from "./route";

const ctx = (token = "tok") => ({ params: Promise.resolve({ token }) });
function req(body: unknown) {
  return new Request("http://localhost/api/auth/reset/tok", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = false;
  mockSession.save = vi.fn();
});

describe("POST /api/auth/reset/[token]", () => {
  it("rejects an unknown token", async () => {
    mockGetAuthToken.mockReturnValue(null);
    const res = await POST(req({ password: "supersecret" }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("rejects a token whose purpose is not 'reset'", async () => {
    mockGetAuthToken.mockReturnValue({ person_id: 9, expires_at: future(), purpose: "invite" });
    const res = await POST(req({ password: "supersecret" }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("rejects and clears an expired token", async () => {
    mockGetAuthToken.mockReturnValue({ person_id: 9, expires_at: past(), purpose: "reset" });
    const res = await POST(req({ password: "supersecret" }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "token_expired" });
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
  });

  it("rejects a too-short password", async () => {
    mockGetAuthToken.mockReturnValue({ person_id: 9, expires_at: future(), purpose: "reset" });
    const res = await POST(req({ password: "short" }), ctx());
    expect(res.status).toBe(400);
    expect(mockSetPasswordHash).not.toHaveBeenCalled();
  });

  it("sets the password, revokes old sessions, and signs the user in", async () => {
    mockGetAuthToken.mockReturnValue({ person_id: 9, expires_at: future(), purpose: "reset" });
    const res = await POST(req({ password: "supersecret" }), ctx());
    expect(res.status).toBe(200);
    expect(mockSetPasswordHash).toHaveBeenCalledOnce();
    expect(mockBumpSessionEpoch).toHaveBeenCalledWith(expect.anything(), 9);
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
    expect(mockSession.save).toHaveBeenCalledOnce();
    expect(mockSession.authenticated).toBe(true);
    expect(mockSession.personId).toBe(9);
  });
});
