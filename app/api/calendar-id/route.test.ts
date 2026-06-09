import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetSetting = vi.fn<(...a: unknown[]) => string>();
vi.mock("@/lib/queries/settings", () => ({
  getSetting: (...a: unknown[]) => mockGetSetting(...a),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/calendar-id", () => {
  it("returns the calendar id from settings", async () => {
    mockGetSetting.mockReturnValue("primary-cal-id-123");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ calendarId: "primary-cal-id-123" });
  });

  it("returns calendarId: null when no calendar is configured", async () => {
    mockGetSetting.mockReturnValue("");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ calendarId: null });
  });
});
