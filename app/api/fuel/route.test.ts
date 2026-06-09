// app/api/fuel/route.test.ts
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

const mockGetFuelFillups = vi.fn((..._a: unknown[]) => [{ id: 1 }]);
const mockGetFuelFillupById = vi.fn((..._a: unknown[]) => ({ id: 7 }));
const mockInsertFuelFillup = vi.fn((..._a: unknown[]) => 7);
vi.mock("@/lib/queries/fuel-fillups", () => ({
  getFuelFillups: (...a: unknown[]) => mockGetFuelFillups(...a),
  getFuelFillupById: (...a: unknown[]) => mockGetFuelFillupById(...a),
  insertFuelFillup: (...a: unknown[]) => mockInsertFuelFillup(...a),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ipCounter = 0;
function postReq(body: unknown) {
  return new Request("http://localhost/api/fuel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}
function getReq() {
  return new Request("http://localhost/api/fuel");
}

const validFillup = {
  person_id: 1,
  car_id: 2,
  date: "2025-01-15",
  amount: 45.5,
  liters: 35.2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetFuelFillups.mockReturnValue([{ id: 1 }]);
  mockGetFuelFillupById.mockReturnValue({ id: 7 });
  mockInsertFuelFillup.mockReturnValue(7);
});

describe("GET /api/fuel", () => {
  it("returns the fillup list for an authenticated member", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
    expect(mockGetFuelFillups).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetFuelFillups).not.toHaveBeenCalled();
  });
});

describe("POST /api/fuel", () => {
  it("creates a fillup and returns the inserted record with 201", async () => {
    const res = await POST(postReq(validFillup), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 7 });
    expect(mockInsertFuelFillup).toHaveBeenCalledOnce();
    expect(mockGetFuelFillupById).toHaveBeenCalledWith({}, 7);
  });

  it("passes the client_id through when provided", async () => {
    const res = await POST(postReq({ ...validFillup, client_id: "xyz-456" }), ctx);
    expect(res.status).toBe(201);
    const [, insertedData] = mockInsertFuelFillup.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(insertedData.client_id).toBe("xyz-456");
  });

  it("returns 400 for an invalid body (missing required fields)", async () => {
    const res = await POST(postReq({ person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockInsertFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/fuel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validFillup),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertFuelFillup).not.toHaveBeenCalled();
  });
});
