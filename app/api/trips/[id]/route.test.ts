// app/api/trips/[id]/route.test.ts
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

// The record's car belongs to person 99 (car owner).
const mockGetCarById = vi.fn();
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
}));

// Existing record: created by person 2, car_id 10.
const existingTrip = { id: 5, person_id: 2, car_id: 10 };

const mockGetTripById = vi.fn();
const mockUpdateTrip = vi.fn();
const mockDeleteTrip = vi.fn();
vi.mock("@/lib/queries/trips", () => {
  class ConflictError extends Error {}
  return {
    getTripById: (...a: unknown[]) => mockGetTripById(...a),
    updateTrip: (...a: unknown[]) => mockUpdateTrip(...a),
    deleteTrip: (...a: unknown[]) => mockDeleteTrip(...a),
    ConflictError,
  };
});

import { DELETE, GET, PUT } from "./route";
// Import the SAME ConflictError class used by the module under test.
import { ConflictError } from "@/lib/queries/trips";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

let ipCounter = 0;
function mutReq(method: "PUT" | "DELETE", body?: unknown) {
  return new Request("http://localhost/api/trips/5", {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
function getReq() {
  return new Request("http://localhost/api/trips/5");
}

const validTrip = {
  person_id: 2,
  car_id: 10,
  date: "2025-01-15",
  start_odometer: 100,
  end_odometer: 200,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = true; // default: admin can do anything
  mockGetTripById.mockReturnValue(existingTrip);
  mockGetCarById.mockReturnValue({ id: 10, owner_person_id: 99 });
});

describe("GET /api/trips/[id]", () => {
  it("returns the trip for an authenticated member", async () => {
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existingTrip);
    expect(mockGetTripById).toHaveBeenCalledWith({}, 5);
  });

  it("returns 404 when the trip does not exist", async () => {
    mockGetTripById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetTripById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/trips/[id]", () => {
  it("updates the trip and returns ok when the user is an admin", async () => {
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateTrip).toHaveBeenCalledWith(
      {},
      5,
      expect.objectContaining({ person_id: 2 }),
      expect.any(Object)
    );
  });

  it("allows the record creator (person_id 2) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2; // matches existingTrip.person_id
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateTrip).toHaveBeenCalledOnce();
  });

  it("allows the car owner (person_id 99) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 99; // matches car.owner_person_id
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateTrip).toHaveBeenCalledOnce();
  });

  it("returns 403 for a user who is not admin, creator, or car owner", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateTrip).not.toHaveBeenCalled();
  });

  it("returns 404 when the trip does not exist", async () => {
    mockGetTripById.mockReturnValue(null);
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateTrip).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const res = await PUT(mutReq("PUT", { person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateTrip).not.toHaveBeenCalled();
  });

  it("returns 409 when updateTrip throws ConflictError", async () => {
    mockUpdateTrip.mockImplementation(() => {
      throw new ConflictError("stale");
    });
    const res = await PUT(mutReq("PUT", validTrip), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "stale" });
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/trips/5", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validTrip),
    });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateTrip).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/trips/[id]", () => {
  it("deletes the trip when the user is an admin", async () => {
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(mockDeleteTrip).toHaveBeenCalledWith({}, 5);
  });

  it("allows the record creator to delete", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(mockDeleteTrip).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthorized user", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteTrip).not.toHaveBeenCalled();
  });

  it("returns 404 when the trip does not exist", async () => {
    mockGetTripById.mockReturnValue(null);
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(404);
    expect(mockDeleteTrip).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/trips/5", {
      method: "DELETE",
      headers: { "x-forwarded-for": `203.0.113.${++ipCounter}` },
    });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeleteTrip).not.toHaveBeenCalled();
  });
});
