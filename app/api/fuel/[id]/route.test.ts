// app/api/fuel/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockGetCarById = vi.fn();
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
}));

// Existing record: created by person 2, car_id 10.
const existingFillup = { id: 5, person_id: 2, car_id: 10 };

const mockGetFuelFillupById = vi.fn();
const mockUpdateFuelFillup = vi.fn();
const mockDeleteFuelFillup = vi.fn();
vi.mock("@/lib/queries/fuel-fillups", () => {
  class ConflictError extends Error {}
  return {
    getFuelFillupById: (...a: unknown[]) => mockGetFuelFillupById(...a),
    updateFuelFillup: (...a: unknown[]) => mockUpdateFuelFillup(...a),
    deleteFuelFillup: (...a: unknown[]) => mockDeleteFuelFillup(...a),
    ConflictError,
  };
});

import { GET, PUT, DELETE } from "./route";
import { ConflictError } from "@/lib/queries/fuel-fillups";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

let ipCounter = 0;
function mutReq(method: "PUT" | "DELETE", body?: unknown) {
  return new Request("http://localhost/api/fuel/5", {
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
  return new Request("http://localhost/api/fuel/5");
}

const validFillup = {
  person_id: 2,
  car_id: 10,
  date: "2025-01-15",
  amount: 45.5,
  liters: 35.2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = true;
  mockGetFuelFillupById.mockReturnValue(existingFillup);
  mockGetCarById.mockReturnValue({ id: 10, owner_person_id: 99 });
});

describe("GET /api/fuel/[id]", () => {
  it("returns the fillup for an authenticated member", async () => {
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existingFillup);
    expect(mockGetFuelFillupById).toHaveBeenCalledWith({}, 5);
  });

  it("returns 404 when the fillup does not exist", async () => {
    mockGetFuelFillupById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetFuelFillupById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/fuel/[id]", () => {
  it("updates the fillup and returns ok when the user is an admin", async () => {
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateFuelFillup).toHaveBeenCalledWith(
      {},
      5,
      expect.objectContaining({ person_id: 2 }),
      expect.any(Object)
    );
  });

  it("allows the record creator (person_id 2) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2;
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateFuelFillup).toHaveBeenCalledOnce();
  });

  it("allows the car owner (person_id 99) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 99;
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateFuelFillup).toHaveBeenCalledOnce();
  });

  it("returns 403 for a user who is not admin, creator, or car owner", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 404 when the fillup does not exist", async () => {
    mockGetFuelFillupById.mockReturnValue(null);
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const res = await PUT(mutReq("PUT", { person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 409 when updateFuelFillup throws ConflictError", async () => {
    mockUpdateFuelFillup.mockImplementation(() => {
      throw new ConflictError("stale");
    });
    const res = await PUT(mutReq("PUT", validFillup), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "stale" });
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/fuel/5", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validFillup),
    });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateFuelFillup).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/fuel/[id]", () => {
  it("deletes the fillup when the user is an admin", async () => {
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(mockDeleteFuelFillup).toHaveBeenCalledWith({}, 5);
  });

  it("allows the record creator to delete", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(mockDeleteFuelFillup).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthorized user", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 404 when the fillup does not exist", async () => {
    mockGetFuelFillupById.mockReturnValue(null);
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(404);
    expect(mockDeleteFuelFillup).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/fuel/5", {
      method: "DELETE",
      headers: { "x-forwarded-for": `203.0.113.${++ipCounter}` },
    });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeleteFuelFillup).not.toHaveBeenCalled();
  });
});
