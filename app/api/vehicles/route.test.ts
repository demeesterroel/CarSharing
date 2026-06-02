// app/api/vehicles/route.test.ts
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
const mockIsOwner = vi.fn(() => false);
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: (...a: unknown[]) => mockIsActivePerson(...a),
  isOwner: (...a: unknown[]) => mockIsOwner(...a),
}));

const mockGetCars = vi.fn(() => [{ id: 1, short: "AA" }]);
const mockInsertCar = vi.fn(() => 9);
vi.mock("@/lib/queries/cars", () => ({
  getCars: (...a: unknown[]) => mockGetCars(...a),
  insertCar: (...a: unknown[]) => mockInsertCar(...a),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ip = 0;
function getReq() {
  return new Request("http://localhost/api/vehicles");
}
function postReq(body: unknown, withCsrf = true) {
  return new Request("http://localhost/api/vehicles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withCsrf
        ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF }
        : {}),
      "x-forwarded-for": `198.51.100.${++ip}`,
    },
    body: JSON.stringify(body),
  });
}

const validCar = {
  short: "BB",
  name: "Car B",
  price_per_km: 0.3,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockIsActivePerson.mockReturnValue(true);
  mockIsOwner.mockReturnValue(false);
});

describe("GET /api/vehicles", () => {
  it("returns the car list without any auth check", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1, short: "AA" }]);
    expect(mockGetCars).toHaveBeenCalledOnce();
  });
});

describe("POST /api/vehicles", () => {
  it("returns 403 for a regular (non-owner, non-admin) member", async () => {
    mockIsOwner.mockReturnValue(false);
    const res = await POST(postReq(validCar), ctx);
    expect(res.status).toBe(403);
    expect(mockInsertCar).not.toHaveBeenCalled();
  });

  it("allows an owner to create a car (sets owner_person_id from session)", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await POST(postReq(validCar), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 9 });
    expect(mockInsertCar).toHaveBeenCalledOnce();
    // Non-admin owner: owner_person_id should be forced to session personId
    const insertedData = mockInsertCar.mock.calls[0][1] as Record<string, unknown>;
    expect(insertedData.owner_person_id).toBe(1);
  });

  it("allows an admin to create a car without forcing owner_person_id", async () => {
    mockSession.isAdmin = true;
    const carWithOwner = { ...validCar, owner_person_id: 5 };
    const res = await POST(postReq(carWithOwner), ctx);
    expect(res.status).toBe(201);
    expect(mockInsertCar).toHaveBeenCalledOnce();
    const insertedData = mockInsertCar.mock.calls[0][1] as Record<string, unknown>;
    expect(insertedData.owner_person_id).toBe(5);
  });

  it("returns 400 for an invalid body (missing name)", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await POST(postReq({ short: "BB", price_per_km: 0.3 }), ctx);
    expect(res.status).toBe(400);
    expect(mockInsertCar).not.toHaveBeenCalled();
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined;
    const res = await POST(postReq(validCar), ctx);
    expect(res.status).toBe(403);
    expect(mockInsertCar).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockIsOwner.mockReturnValue(true);
    const res = await POST(postReq(validCar, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertCar).not.toHaveBeenCalled();
  });
});
