// app/api/reservations/route.test.ts
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

const mockGetReservations = vi.fn((..._a: unknown[]) => [{ id: 1 }]);
const mockInsertReservation = vi.fn((..._a: unknown[]) => 7);
const mockGetReservationById = vi.fn((..._a: unknown[]) => ({ id: 7, person_id: 1, car_id: 2 }));
vi.mock("@/lib/queries/reservations", () => ({
  getReservations: (...a: unknown[]) => mockGetReservations(...a),
  insertReservation: (...a: unknown[]) => mockInsertReservation(...a),
  getReservationById: (...a: unknown[]) => mockGetReservationById(...a),
}));

vi.mock("@/lib/reservation-sync", () => ({
  syncReservationCreate: vi.fn(() => Promise.resolve()),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ip = 0;
function getReq() {
  return new Request("http://localhost/api/reservations");
}
function postReq(body: unknown, withCsrf = true) {
  return new Request("http://localhost/api/reservations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {}),
      "x-forwarded-for": `198.51.100.${++ip}`,
    },
    body: JSON.stringify(body),
  });
}

const validReservation = {
  person_id: 2,
  car_id: 3,
  start_date: "2025-06-01",
  end_date: "2025-06-03",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
});

describe("GET /api/reservations", () => {
  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetReservations).not.toHaveBeenCalled();
  });

  it("returns the reservation list for an authenticated user", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
    expect(mockGetReservations).toHaveBeenCalledOnce();
  });
});

describe("POST /api/reservations", () => {
  it("returns 403 for an unauthenticated request (no insert, no sync)", async () => {
    mockSession.personId = undefined as unknown as number;
    const { syncReservationCreate } = await import("@/lib/reservation-sync");
    const res = await POST(postReq(validReservation), ctx);
    expect(res.status).toBe(403);
    expect(mockInsertReservation).not.toHaveBeenCalled();
    expect(syncReservationCreate).not.toHaveBeenCalled();
  });

  it("creates a reservation with a valid body", async () => {
    const res = await POST(postReq(validReservation), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 7 });
    expect(mockInsertReservation).toHaveBeenCalledOnce();
  });

  it("returns 400 for an invalid body (missing car_id)", async () => {
    const res = await POST(
      postReq({ person_id: 2, start_date: "2025-06-01", end_date: "2025-06-03" }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockInsertReservation).not.toHaveBeenCalled();
  });

  it("returns 400 when end_date is before start_date", async () => {
    const res = await POST(
      postReq({ person_id: 2, car_id: 3, start_date: "2025-06-05", end_date: "2025-06-01" }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(mockInsertReservation).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    const res = await POST(postReq(validReservation, false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertReservation).not.toHaveBeenCalled();
  });
});
