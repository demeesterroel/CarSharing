// app/api/vehicles/[id]/last-state/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetLastCarState = vi.fn();
vi.mock("@/lib/queries/car-state", () => ({
  getLastCarState: (...a: unknown[]) => mockGetLastCarState(...a),
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ id: "5" }) };

function getReq() {
  return new Request("http://localhost/api/vehicles/5/last-state");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLastCarState.mockReturnValue({ odometer: 12345, location: "Garage", source: "trip" });
});

describe("GET /api/vehicles/[id]/last-state", () => {
  it("returns the last car state when it exists", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ odometer: 12345, location: "Garage", source: "trip" });
    expect(mockGetLastCarState).toHaveBeenCalledOnce();
  });

  it("returns null when the car has no recorded state", async () => {
    mockGetLastCarState.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
