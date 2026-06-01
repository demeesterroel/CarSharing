import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = { authenticated: true, personId: 1, isAdmin: true, save: vi.fn() };
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: vi.fn(() => true),
  isOwner: vi.fn(() => false),
}));

const mockDuplicateTrips = vi.fn(() => []);
vi.mock("@/lib/queries/admin", () => ({
  getCarPnL: vi.fn(() => []),
  getKmGaps: vi.fn(() => []),
  getZeroKmTrips: vi.fn(() => []),
  getMonthlyCarKm: vi.fn(() => []),
  getPersonContributions: vi.fn(() => []),
  getHistoricalCarKm: vi.fn(() => []),
  getPriceHistory: vi.fn(() => []),
  getRollingFuelPerKm: vi.fn(() => []),
  getHistoricalOwnerSplit: vi.fn(() => []),
  getHistoricalExpenses: vi.fn(() => []),
  getDuplicateTrips: (...a: unknown[]) => mockDuplicateTrips(...a),
}));

vi.mock("@/lib/queries/dashboard", () => ({ getDashboard: vi.fn(() => []) }));

import { GET } from "./route";

function makeReq() {
  return new Request("http://localhost/api/admin/summary?year=2026");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
});

describe("GET /api/admin/summary", () => {
  it("returns 403 for non-admin, non-owner", async () => {
    mockSession.isAdmin = false;
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("includes duplicateTrips in the response for an admin", async () => {
    const fakePair = {
      trip1_id: 1,
      trip2_id: 2,
      person_name: "Alice",
      car_short: "TT",
      date1: "2024-01-01",
      date2: "2024-01-02",
      start_odometer: 100,
      end_odometer: 200,
      km: 100,
      amount1: 20,
      amount2: 20,
    };
    mockDuplicateTrips.mockReturnValue([fakePair]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicateTrips).toEqual([fakePair]);
  });
});
