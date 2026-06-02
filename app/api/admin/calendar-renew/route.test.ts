import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    CRON_SECRET: "test-cron-secret",
  },
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockHandleCalendarRenew = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("@/lib/calendar-renew", () => ({
  handleCalendarRenew: (...a: unknown[]) => mockHandleCalendarRenew(...a),
}));

import { GET } from "./route";

function req(authHeader?: string) {
  return new Request("http://localhost/api/admin/calendar-renew", {
    method: "GET",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHandleCalendarRenew.mockResolvedValue({ ok: true, renewed: true });
});

describe("GET /api/admin/calendar-renew", () => {
  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(req() as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
    expect(mockHandleCalendarRenew).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header has wrong secret", async () => {
    const res = await GET(req("Bearer wrong-secret") as any);
    expect(res.status).toBe(401);
    expect(mockHandleCalendarRenew).not.toHaveBeenCalled();
  });

  it("returns 200 with renew result on valid CRON_SECRET", async () => {
    const res = await GET(req("Bearer test-cron-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, renewed: true });
    expect(mockHandleCalendarRenew).toHaveBeenCalledOnce();
  });

  it("returns 200 with skipped result when calendar renew is not due", async () => {
    mockHandleCalendarRenew.mockResolvedValue({ ok: true, skipped: "not_due" });
    const res = await GET(req("Bearer test-cron-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, skipped: "not_due" });
  });

  it("returns 500 when handleCalendarRenew throws", async () => {
    mockHandleCalendarRenew.mockRejectedValue(new Error("network failure"));
    const res = await GET(req("Bearer test-cron-secret") as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false });
    expect(String(body.error)).toContain("network failure");
  });
});
