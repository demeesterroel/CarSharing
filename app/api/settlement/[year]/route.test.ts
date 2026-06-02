import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockSession: Record<string, unknown> = {
  authenticated: true,
  personId: 1,
  isAdmin: true,
  shortName: "Admin",
  save: vi.fn(),
};
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

// requireAdminOrOwner and requireAdmin check isOwner and isActivePerson via queries/people
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: vi.fn(() => true),
  isOwner: vi.fn(() => false),
  getSessionEpoch: vi.fn(() => undefined),
}));

const mockGetSettlement = vi.fn();
const mockLockSettlement = vi.fn();
const mockUnlockSettlement = vi.fn();
vi.mock("@/lib/queries/settlement", () => ({
  getSettlement: (...a: unknown[]) => mockGetSettlement(...a),
  lockSettlement: (...a: unknown[]) => mockLockSettlement(...a),
  unlockSettlement: (...a: unknown[]) => mockUnlockSettlement(...a),
}));

import { GET, POST } from "./route";

let ipCounter = 0;
function getReq(year: string) {
  return new Request(`http://localhost/api/settlement/${year}?year=${year}`);
}
function postReq(year: string) {
  return new Request(`http://localhost/api/settlement/${year}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify({}),
  });
}
function makeCtx(year: string) {
  return { params: Promise.resolve({ year }) };
}

const fakeSettlement = { frozen: false, members: [], transfers: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
  mockSession.personId = 1;
  mockGetSettlement.mockReturnValue(fakeSettlement);
});

describe("GET /api/settlement/[year]", () => {
  it("returns settlement data for a valid year (admin)", async () => {
    const res = await GET(getReq("2025"), makeCtx("2025"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fakeSettlement);
    expect(mockGetSettlement).toHaveBeenCalledWith({}, 2025);
  });

  it("returns 403 for non-admin, non-owner", async () => {
    mockSession.isAdmin = false;
    const res = await GET(getReq("2025"), makeCtx("2025"));
    expect(res.status).toBe(403);
    expect(mockGetSettlement).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid year string", async () => {
    const res = await GET(getReq("abc"), makeCtx("abc"));
    expect(res.status).toBe(400);
    expect(mockGetSettlement).not.toHaveBeenCalled();
  });

  it("returns 400 for a year out of range", async () => {
    const res = await GET(getReq("1999"), makeCtx("1999"));
    expect(res.status).toBe(400);
    expect(mockGetSettlement).not.toHaveBeenCalled();
  });
});

describe("POST /api/settlement/[year] (lock/unlock toggle)", () => {
  it("locks an unfrozen settlement", async () => {
    mockGetSettlement.mockReturnValue({ ...fakeSettlement, frozen: false });
    const res = await POST(postReq("2025"), makeCtx("2025"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockLockSettlement).toHaveBeenCalledOnce();
    expect(mockUnlockSettlement).not.toHaveBeenCalled();
  });

  it("unlocks a frozen settlement", async () => {
    mockGetSettlement.mockReturnValue({ ...fakeSettlement, frozen: true });
    const res = await POST(postReq("2025"), makeCtx("2025"));
    expect(res.status).toBe(200);
    expect(mockUnlockSettlement).toHaveBeenCalledOnce();
    expect(mockLockSettlement).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    mockSession.isAdmin = false;
    const res = await POST(postReq("2025"), makeCtx("2025"));
    expect(res.status).toBe(403);
    expect(mockLockSettlement).not.toHaveBeenCalled();
    expect(mockUnlockSettlement).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid year in POST", async () => {
    const res = await POST(postReq("bad"), makeCtx("bad"));
    expect(res.status).toBe(400);
  });
});
