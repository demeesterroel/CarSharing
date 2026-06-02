import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetDashboard = vi.fn();
vi.mock("@/lib/queries/dashboard", () => ({
  getDashboard: (...a: unknown[]) => mockGetDashboard(...a),
  getEarliestYear: vi.fn(() => 2024),
}));

import { GET } from "./route";

function req(url: string) {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboard.mockReturnValue([]);
});

describe("GET /api/dashboard", () => {
  it("returns dashboard data for a valid year", async () => {
    const fakeRow = { person_id: 1, person_name: "Alice", trip_count: 5 };
    mockGetDashboard.mockReturnValue([fakeRow]);
    const res = await GET(req("http://localhost/api/dashboard?year=2025"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([fakeRow]);
    expect(mockGetDashboard).toHaveBeenCalledWith({}, 2025);
  });

  it("uses the current year when year is omitted", async () => {
    const res = await GET(req("http://localhost/api/dashboard"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(mockGetDashboard).toHaveBeenCalledOnce();
    const [, yearArg] = mockGetDashboard.mock.calls[0];
    expect(typeof yearArg).toBe("number");
    expect(yearArg).toBeGreaterThanOrEqual(2000);
  });

  it("returns 400 for an invalid year", async () => {
    const res = await GET(req("http://localhost/api/dashboard?year=abc"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    expect(mockGetDashboard).not.toHaveBeenCalled();
  });

  it("returns 400 for a year out of range", async () => {
    const res = await GET(req("http://localhost/api/dashboard?year=1999"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    expect(mockGetDashboard).not.toHaveBeenCalled();
  });
});
