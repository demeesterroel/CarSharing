import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockSession = {
  authenticated: false,
  personId: 0,
  shortName: "",
  isAdmin: false,
  epoch: undefined as number | undefined,
  save: vi.fn(),
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));

const mockGetAuthToken = vi.fn<(...a: unknown[]) => unknown>();
const mockDeleteAuthToken = vi.fn<(...a: unknown[]) => unknown>();
const mockGetPersonById = vi.fn<(...a: unknown[]) => unknown>();
const mockGetSessionEpoch = vi.fn<(...a: unknown[]) => number>(() => 5);
vi.mock("@/lib/queries/people", () => ({
  getAuthToken: (...a: unknown[]) => mockGetAuthToken(...a),
  deleteAuthToken: (...a: unknown[]) => mockDeleteAuthToken(...a),
  getPersonById: (...a: unknown[]) => mockGetPersonById(...a),
  getSessionEpoch: (...a: unknown[]) => mockGetSessionEpoch(...a),
  shortNameOf: (p: { first_name?: string }) => p.first_name ?? "Person",
}));

import { GET } from "./route";

const ctx = (token = "valid-magic-token") => ({ params: Promise.resolve({ token }) });
function req(token = "valid-magic-token") {
  return new Request(`http://localhost/api/auth/magic/${token}`);
}

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = false;
  mockSession.personId = 0;
  mockSession.shortName = "";
  mockSession.isAdmin = false;
  mockSession.epoch = undefined;
  mockSession.save = vi.fn();
  mockGetPersonById.mockReturnValue({ id: 7, first_name: "Alice", is_admin: 0 });
  mockGetSessionEpoch.mockReturnValue(5);
});

describe("GET /api/auth/magic/[token]", () => {
  it("redirects to /login?error=magic when token is not found", async () => {
    mockGetAuthToken.mockReturnValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=magic");
    expect(mockDeleteAuthToken).not.toHaveBeenCalled();
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=magic and deletes token when purpose is not 'magic'", async () => {
    mockGetAuthToken.mockReturnValue({
      person_id: 7,
      expires_at: future(),
      purpose: "invite",
    });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=magic");
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
  });

  it("redirects to /login?error=magic and deletes token when token is expired", async () => {
    mockGetAuthToken.mockReturnValue({
      person_id: 7,
      expires_at: past(),
      purpose: "magic",
    });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=magic");
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=magic when person is not found", async () => {
    mockGetAuthToken.mockReturnValue({
      person_id: 99,
      expires_at: future(),
      purpose: "magic",
    });
    mockGetPersonById.mockReturnValue(undefined);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=magic");
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("creates session, deletes token, and redirects to / on valid magic token", async () => {
    mockGetAuthToken.mockReturnValue({
      person_id: 7,
      expires_at: future(),
      purpose: "magic",
    });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect(mockSession.authenticated).toBe(true);
    expect(mockSession.personId).toBe(7);
    expect(mockSession.shortName).toBe("Alice");
    expect(mockSession.isAdmin).toBe(false);
    expect(mockSession.epoch).toBe(5);
    expect(mockSession.save).toHaveBeenCalledOnce();
    expect(mockDeleteAuthToken).toHaveBeenCalledOnce();
  });

  it("sets isAdmin:true for admin person", async () => {
    mockGetAuthToken.mockReturnValue({
      person_id: 7,
      expires_at: future(),
      purpose: "magic",
    });
    mockGetPersonById.mockReturnValue({ id: 7, first_name: "Bob", is_admin: 1 });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect(mockSession.isAdmin).toBe(true);
  });
});
