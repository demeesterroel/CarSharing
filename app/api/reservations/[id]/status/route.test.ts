// app/api/reservations/[id]/status/route.test.ts
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
const mockUpdateReservationStatus = vi.fn();
vi.mock("@/lib/queries/reservations", () => ({
  getReservationById: (...a: unknown[]) => mockGetReservationById(...a),
  updateReservationStatus: (...a: unknown[]) => mockUpdateReservationStatus(...a),
}));

const mockGetCarById = vi.fn();
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
}));

vi.mock("@/lib/reservation-sync", () => ({
  syncReservationUpdate: vi.fn(() => Promise.resolve()),
}));

import { PATCH } from "./route";

const CSRF = "test-csrf-token";
function makeReq(body: unknown = { status: "confirmed" }, withCsrf = true) {
  return new Request("http://localhost/api/reservations/5/status", {
    method: "PATCH",
    headers: withCsrf
      ? { "Content-Type": "application/json", Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetReservationById.mockReturnValue({ id: 5, car_id: 9, person_id: 2 });
  mockGetCarById.mockReturnValue({ id: 9, owner_person_id: 42 });
});

describe("PATCH /api/reservations/[id]/status", () => {
  it("returns 403 for a member who is neither admin nor the car owner", async () => {
    mockSession.personId = 7; // not the owner (42), not the creator either
    const res = await PATCH(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateReservationStatus).not.toHaveBeenCalled();
  });

  it("allows the car owner to change the status", async () => {
    mockSession.personId = 42; // matches car.owner_person_id
    const res = await PATCH(makeReq(), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateReservationStatus).toHaveBeenCalledWith({}, 5, "confirmed");
  });

  it("allows an admin to change the status", async () => {
    mockSession.isAdmin = true;
    mockSession.personId = 999;
    const res = await PATCH(makeReq({ status: "rejected" }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateReservationStatus).toHaveBeenCalledWith({}, 5, "rejected");
  });

  it("returns 404 when the reservation does not exist", async () => {
    mockGetReservationById.mockReturnValue(null);
    mockSession.isAdmin = true;
    const res = await PATCH(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateReservationStatus).not.toHaveBeenCalled();
  });

  it("rejects the mutation without a CSRF token", async () => {
    mockSession.isAdmin = true;
    const res = await PATCH(makeReq({ status: "confirmed" }, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateReservationStatus).not.toHaveBeenCalled();
  });
});
