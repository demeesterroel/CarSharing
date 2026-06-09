// app/api/trips/route.test.ts
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

const mockGetTrips = vi.fn((..._a: unknown[]) => [{ id: 1 }]);
const mockGetTripById = vi.fn((..._a: unknown[]) => ({ id: 7 }));
const mockInsertTrip = vi.fn((..._a: unknown[]) => 7);
vi.mock("@/lib/queries/trips", () => ({
  getTrips: (...a: unknown[]) => mockGetTrips(...a),
  getTripById: (...a: unknown[]) => mockGetTripById(...a),
  insertTrip: (...a: unknown[]) => mockInsertTrip(...a),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ipCounter = 0;
function postReq(body: unknown) {
  return new Request("http://localhost/api/trips", {
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
  return new Request("http://localhost/api/trips");
}

const validTrip = {
  person_id: 1,
  car_id: 2,
  date: "2025-01-15",
  start_odometer: 100,
  end_odometer: 200,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetTrips.mockReturnValue([{ id: 1 }]);
  mockGetTripById.mockReturnValue({ id: 7 });
  mockInsertTrip.mockReturnValue(7);
});

describe("GET /api/trips", () => {
  it("returns the trips list for an authenticated member", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
    expect(mockGetTrips).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthenticated request (no personId)", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetTrips).not.toHaveBeenCalled();
  });
});

describe("POST /api/trips", () => {
  it("creates a trip and returns the inserted record with 201", async () => {
    const res = await POST(postReq(validTrip), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 7 });
    expect(mockInsertTrip).toHaveBeenCalledOnce();
    expect(mockGetTripById).toHaveBeenCalledWith({}, 7);
  });

  it("passes the client_id through when provided", async () => {
    const res = await POST(postReq({ ...validTrip, client_id: "abc-123" }), ctx);
    expect(res.status).toBe(201);
    const [, insertedData] = mockInsertTrip.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(insertedData.client_id).toBe("abc-123");
  });

  it("returns 400 for an invalid body (missing required fields)", async () => {
    const res = await POST(postReq({ person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockInsertTrip).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validTrip),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertTrip).not.toHaveBeenCalled();
  });

  it("returns 403 for an unauthenticated request (POST now requires a session)", async () => {
    // The trips POST handler calls requireSession to get session data for
    // admin-change notifications. An unauthenticated request returns 403.
    mockSession.personId = undefined as unknown as number;
    const res = await POST(postReq(validTrip), ctx);
    expect(res.status).toBe(403);
    expect(mockInsertTrip).not.toHaveBeenCalled();
  });
});
