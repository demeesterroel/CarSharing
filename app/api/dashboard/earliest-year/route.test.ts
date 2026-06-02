import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetEarliestYear = vi.fn();
vi.mock("@/lib/queries/dashboard", () => ({
  getDashboard: vi.fn(() => []),
  getEarliestYear: (...a: unknown[]) => mockGetEarliestYear(...a),
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEarliestYear.mockReturnValue(2022);
});

describe("GET /api/dashboard/earliest-year", () => {
  it("returns the earliest year from the database", async () => {
    const res = await GET(new Request("http://localhost/api/dashboard/earliest-year"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ year: 2022 });
    expect(mockGetEarliestYear).toHaveBeenCalledOnce();
  });

  it("returns null year when there is no data", async () => {
    mockGetEarliestYear.mockReturnValue(null);
    const res = await GET(new Request("http://localhost/api/dashboard/earliest-year"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ year: null });
  });
});
