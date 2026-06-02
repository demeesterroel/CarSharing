// app/api/vehicles/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession: Record<string, unknown> = {
  personId: 1,
  isAdmin: false,
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockIsActivePerson = vi.fn(() => true);
const mockIsOwner = vi.fn(() => true);
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: (...a: unknown[]) => mockIsActivePerson(...a),
  isOwner: (...a: unknown[]) => mockIsOwner(...a),
}));

const mockGetCarById = vi.fn();
const mockUpdateCar = vi.fn();
const mockDeleteCar = vi.fn();
const mockCarHasHistory = vi.fn(() => false);
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
  updateCar: (...a: unknown[]) => mockUpdateCar(...a),
  deleteCar: (...a: unknown[]) => mockDeleteCar(...a),
  carHasHistory: (...a: unknown[]) => mockCarHasHistory(...a),
}));

import { GET, PUT, DELETE } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

let ip = 0;
function getReq() {
  return new Request("http://localhost/api/vehicles/5");
}
function putReq(body: unknown, withCsrf = true) {
  return new Request("http://localhost/api/vehicles/5", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {}),
      "x-forwarded-for": `198.51.100.${++ip}`,
    },
    body: JSON.stringify(body),
  });
}
function deleteReq(withCsrf = true) {
  return new Request("http://localhost/api/vehicles/5", {
    method: "DELETE",
    headers: {
      ...(withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {}),
      "x-forwarded-for": `198.51.100.${++ip}`,
    },
  });
}

// A full car body valid against carSchema (admin PUT)
const validCarBody = {
  short: "BB",
  name: "Car B",
  price_per_km: 0.3,
  owner_person_id: 1,
};

// An owner-only patch body valid against ownerCarPatchSchema
const ownerPatch = {
  name: "Car B Updated",
  price_per_km: 0.35,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockIsOwner.mockReturnValue(true);
  mockIsActivePerson.mockReturnValue(true);
  // Car is owned by session person (1)
  mockGetCarById.mockReturnValue({
    id: 5,
    short: "BB",
    name: "Car B",
    price_per_km: 0.3,
    brand: null,
    color: null,
    owner_person_id: 1,
    long_threshold: 500,
    active: 1,
    expected_km: null,
  });
  mockCarHasHistory.mockReturnValue(false);
});

describe("GET /api/vehicles/[id]", () => {
  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetCarById).not.toHaveBeenCalled();
  });

  it("returns the car for an authenticated request", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 5 });
    expect(mockGetCarById).toHaveBeenCalledOnce();
  });

  it("returns 404 when the car does not exist", async () => {
    mockGetCarById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/vehicles/[id]", () => {
  it("returns 403 when not authenticated (no personId)", async () => {
    mockSession.personId = undefined;
    const res = await PUT(putReq(ownerPatch), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateCar).not.toHaveBeenCalled();
  });

  it("returns 403 for a regular member who is not an owner", async () => {
    mockIsOwner.mockReturnValue(false);
    const res = await PUT(putReq(ownerPatch), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateCar).not.toHaveBeenCalled();
  });

  it("returns 403 when owner tries to update a car they do not own", async () => {
    mockIsOwner.mockReturnValue(true);
    mockGetCarById.mockReturnValue({
      id: 5,
      owner_person_id: 99,
      short: "XX",
      name: "Other",
      price_per_km: 0.2,
      brand: null,
      color: null,
      long_threshold: 500,
      active: 1,
      expected_km: null,
    });
    const res = await PUT(putReq(ownerPatch), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateCar).not.toHaveBeenCalled();
  });

  it("allows the car owner to update using ownerCarPatchSchema", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await PUT(putReq(ownerPatch), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateCar).toHaveBeenCalledOnce();
  });

  it("allows an admin to update using full carSchema", async () => {
    mockSession.isAdmin = true;
    const res = await PUT(putReq(validCarBody), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateCar).toHaveBeenCalledOnce();
  });

  it("returns 400 when owner sends invalid patch (missing name)", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await PUT(putReq({ price_per_km: 0.35 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateCar).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await PUT(putReq(ownerPatch, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateCar).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/vehicles/[id]", () => {
  it("returns 403 when not authenticated", async () => {
    mockSession.personId = undefined;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });

  it("returns 403 for a member who is neither admin nor owner", async () => {
    mockIsOwner.mockReturnValue(false);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });

  it("returns 403 when owner tries to delete a car they do not own", async () => {
    mockIsOwner.mockReturnValue(true);
    mockGetCarById.mockReturnValue({ id: 5, owner_person_id: 99 });
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });

  it("allows the car owner to delete a car with no history", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDeleteCar).toHaveBeenCalledOnce();
  });

  it("returns 409 when the car has reservations or trips", async () => {
    mockIsOwner.mockReturnValue(true);
    mockCarHasHistory.mockReturnValue(true);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(409);
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });

  it("allows an admin to delete any car", async () => {
    mockSession.isAdmin = true;
    mockSession.personId = 999;
    mockGetCarById.mockReturnValue({ id: 5, owner_person_id: 1 });
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockDeleteCar).toHaveBeenCalledOnce();
  });

  it("returns 404 when the car does not exist", async () => {
    mockIsOwner.mockReturnValue(true);
    mockGetCarById.mockReturnValue(null);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(404);
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await DELETE(deleteReq(false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeleteCar).not.toHaveBeenCalled();
  });
});
