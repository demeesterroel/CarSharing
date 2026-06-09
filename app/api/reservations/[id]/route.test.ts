// app/api/reservations/[id]/route.test.ts
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

const mockGetReservationById = vi.fn();
const mockUpdateReservation = vi.fn();
const mockDeleteReservation = vi.fn();
vi.mock("@/lib/queries/reservations", () => ({
  getReservationById: (...a: unknown[]) => mockGetReservationById(...a),
  updateReservation: (...a: unknown[]) => mockUpdateReservation(...a),
  deleteReservation: (...a: unknown[]) => mockDeleteReservation(...a),
  ConflictError: class ConflictError extends Error {
    constructor(message = "Conflict") {
      super(message);
      this.name = "ConflictError";
    }
  },
}));

const mockGetCarById = vi.fn();
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
}));

vi.mock("@/lib/reservation-sync", () => ({
  syncReservationUpdate: vi.fn(() => Promise.resolve()),
  syncReservationDelete: vi.fn(() => Promise.resolve()),
}));

import { DELETE, GET, PUT } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

let ip = 0;
function getReq() {
  return new Request("http://localhost/api/reservations/5");
}
function putReq(body: unknown, withCsrf = true) {
  return new Request("http://localhost/api/reservations/5", {
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
  return new Request("http://localhost/api/reservations/5", {
    method: "DELETE",
    headers: {
      ...(withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {}),
      "x-forwarded-for": `198.51.100.${++ip}`,
    },
  });
}

const validBody = {
  person_id: 2,
  car_id: 3,
  start_date: "2025-06-01",
  end_date: "2025-06-03",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  // By default: reservation owned by person 2, car owned by person 42
  mockGetReservationById.mockReturnValue({ id: 5, person_id: 2, car_id: 3 });
  mockGetCarById.mockReturnValue({ id: 3, owner_person_id: 42 });
});

describe("GET /api/reservations/[id]", () => {
  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetReservationById).not.toHaveBeenCalled();
  });

  it("returns the reservation for an authenticated user", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 5 });
  });

  it("returns 404 when reservation does not exist", async () => {
    mockGetReservationById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/reservations/[id]", () => {
  it("returns 403 when not authenticated", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateReservation).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not creator, admin, or car owner", async () => {
    mockSession.personId = 99; // not person_id=2, not car owner=42
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateReservation).not.toHaveBeenCalled();
  });

  it("allows the reservation creator to update it", async () => {
    mockSession.personId = 2; // matches reservation.person_id
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateReservation).toHaveBeenCalledOnce();
  });

  it("allows the car owner to update the reservation", async () => {
    mockSession.personId = 42; // matches car.owner_person_id
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateReservation).toHaveBeenCalledOnce();
  });

  it("allows an admin to update any reservation", async () => {
    mockSession.isAdmin = true;
    mockSession.personId = 999;
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateReservation).toHaveBeenCalledOnce();
  });

  it("returns 404 when reservation does not exist", async () => {
    mockSession.isAdmin = true;
    mockGetReservationById.mockReturnValue(null);
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateReservation).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    mockSession.personId = 2;
    const res = await PUT(putReq({ person_id: 2 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateReservation).not.toHaveBeenCalled();
  });

  it("returns 409 when updateReservation throws ConflictError", async () => {
    mockSession.personId = 2;
    const { ConflictError } = await import("@/lib/queries/reservations");
    mockUpdateReservation.mockImplementation(() => {
      throw new ConflictError("already updated");
    });
    const res = await PUT(putReq(validBody), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "already updated" });
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockSession.personId = 2;
    const res = await PUT(putReq(validBody, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateReservation).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/reservations/[id]", () => {
  it("returns 403 when not authenticated", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteReservation).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not creator, admin, or car owner", async () => {
    mockSession.personId = 99;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteReservation).not.toHaveBeenCalled();
  });

  it("allows the reservation creator to delete it", async () => {
    mockSession.personId = 2;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(mockDeleteReservation).toHaveBeenCalledOnce();
  });

  it("allows an admin to delete any reservation", async () => {
    mockSession.isAdmin = true;
    mockSession.personId = 999;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockDeleteReservation).toHaveBeenCalledOnce();
  });

  it("returns 404 when reservation does not exist", async () => {
    mockSession.isAdmin = true;
    mockGetReservationById.mockReturnValue(null);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(404);
    expect(mockDeleteReservation).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockSession.personId = 2;
    const res = await DELETE(deleteReq(false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeleteReservation).not.toHaveBeenCalled();
  });
});
