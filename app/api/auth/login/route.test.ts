// app/api/auth/login/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockSession = {
  authenticated: false as boolean,
  personId: undefined as number | undefined,
  shortName: undefined as string | undefined,
  isAdmin: false,
  save: vi.fn(),
};

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetPersonByUsername = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  getPersonByUsername: (...args: unknown[]) => mockGetPersonByUsername(...args),
  isOwner: vi.fn(() => false),
  shortNameOf: (p: { first_name?: string }) => p.first_name ?? "Person",
}));

const mockVerifyCredentials = vi.fn();
vi.mock("@/lib/auth", () => ({
  verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}));

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    AUTH_USERNAME: undefined,
    AUTH_PASSWORD_HASH: undefined,
  },
}));

// Each request gets a unique client IP by default so the brute-force rate
// limiter (keyed on IP) does not bleed state between unrelated test cases.
let ipCounter = 0;
function makeReq(body: unknown, ip?: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

const alicePerson = {
  id: 1,
  first_name: "Alice",
  last_name: "",
  username: "alice",
  password_hash: "hashed",
  is_admin: 0,
  active: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = false;
  mockSession.personId = undefined;
  mockSession.shortName = undefined;
  mockSession.isAdmin = false;
  mockSession.save = vi.fn();
  mockGetPersonByUsername.mockReturnValue(alicePerson);
  mockVerifyCredentials.mockResolvedValue(true);
});

describe("POST /api/auth/login", () => {
  it("returns 200 and saves session on valid credentials", async () => {
    const res = await POST(makeReq({ username: "alice", password: "correct" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSession.authenticated).toBe(true);
    expect(mockSession.personId).toBe(1);
    expect(mockSession.save).toHaveBeenCalledOnce();
  });

  it("returns 401 on wrong password", async () => {
    mockVerifyCredentials.mockResolvedValue(false);
    const res = await POST(makeReq({ username: "alice", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_credentials" });
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("returns 401 when person not found", async () => {
    mockGetPersonByUsername.mockReturnValue(undefined);
    const res = await POST(makeReq({ username: "nobody", password: "pw" }));
    expect(res.status).toBe(401);
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when username or password are not strings", async () => {
    const res = await POST(makeReq({ username: 123, password: true }));
    expect(res.status).toBe(401);
  });

  it("stores isAdmin=true when person has is_admin=1", async () => {
    mockGetPersonByUsername.mockReturnValue({ ...alicePerson, is_admin: 1 });
    await POST(makeReq({ username: "alice", password: "correct" }));
    expect(mockSession.isAdmin).toBe(true);
  });

  it("rate-limits repeated attempts from the same IP", async () => {
    mockVerifyCredentials.mockResolvedValue(false);
    const ip = "198.51.100.7";
    // 5 attempts are allowed within the window.
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq({ username: "alice", password: "x" }, ip));
      expect(res.status).toBe(401);
    }
    // The 6th is throttled before credentials are ever checked.
    const blocked = await POST(makeReq({ username: "alice", password: "x" }, ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(await blocked.json()).toMatchObject({ error: "too_many_requests" });
  });
});
