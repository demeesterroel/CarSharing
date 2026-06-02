import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));

const mockRun = vi.fn();
const mockGet = vi.fn<(...a: unknown[]) => unknown>();
const mockPrepare = vi.fn(() => ({ get: mockGet, run: mockRun }));
const mockDb = { prepare: mockPrepare };
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mockDb) }));

const mockGetSetting = vi.fn<(...a: unknown[]) => string>();
vi.mock("@/lib/queries/settings", () => ({
  getSetting: (...a: unknown[]) => mockGetSetting(...a),
}));

const mockListEventsDelta = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("@/lib/google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  listEventsDelta: (...a: unknown[]) => mockListEventsDelta(...a),
}));

const mockProcessCalendarDelta = vi.fn<(...a: unknown[]) => Promise<void>>();
vi.mock("@/lib/process-calendar-delta", () => ({
  processCalendarDelta: (...a: unknown[]) => mockProcessCalendarDelta(...a),
}));

import { POST } from "./route";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/calendar-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSetting.mockImplementation((_, key: unknown) => {
    if (key === "google_calendar_id") return "cal-id";
    if (key === "google_oauth_refresh_token") return "refresh-token";
    return "";
  });
  // Default: no existing sync state row
  mockGet.mockReturnValue(undefined);
  mockListEventsDelta.mockResolvedValue({ items: [], nextSyncToken: "new-tok" });
  mockProcessCalendarDelta.mockResolvedValue(undefined);
});

describe("POST /api/calendar-webhook", () => {
  it("returns ok immediately on Google handshake (sync resource state)", async () => {
    const res = await POST(req({ "x-goog-resource-state": "sync" }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockListEventsDelta).not.toHaveBeenCalled();
    expect(mockProcessCalendarDelta).not.toHaveBeenCalled();
  });

  it("returns ok without processing when calendar_id or refresh_token is missing", async () => {
    mockGetSetting.mockReturnValue("");
    const res = await POST(req({ "x-goog-resource-state": "exists" }) as any);
    expect(res.status).toBe(200);
    expect(mockListEventsDelta).not.toHaveBeenCalled();
  });

  it("processes delta and upserts sync token on valid webhook call (no prior state)", async () => {
    mockListEventsDelta.mockResolvedValue({
      items: [{ id: "evt-1", etag: '"abc"' }],
      nextSyncToken: "new-tok",
    });
    const res = await POST(req({ "x-goog-resource-state": "exists" }) as any);
    expect(res.status).toBe(200);
    expect(mockListEventsDelta).toHaveBeenCalledOnce();
    expect(mockProcessCalendarDelta).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledWith("new-tok");
  });

  it("rejects webhook call with wrong channel ID (spoof protection)", async () => {
    mockGet.mockReturnValue({ sync_token: "tok", channel_id: "real-channel-id" });
    const res = await POST(
      req({ "x-goog-resource-state": "exists", "x-goog-channel-id": "spoofed-channel" }) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockListEventsDelta).not.toHaveBeenCalled();
  });

  it("processes delta when channel ID matches stored state", async () => {
    mockGet.mockReturnValue({ sync_token: "stored-tok", channel_id: "real-channel-id" });
    const res = await POST(
      req({ "x-goog-resource-state": "exists", "x-goog-channel-id": "real-channel-id" }) as any
    );
    expect(res.status).toBe(200);
    expect(mockListEventsDelta).toHaveBeenCalledWith(expect.anything(), "cal-id", "stored-tok");
    expect(mockProcessCalendarDelta).toHaveBeenCalledOnce();
  });

  it("falls back to full re-sync on 410 from listEventsDelta", async () => {
    mockListEventsDelta
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { code: 410 }))
      .mockResolvedValueOnce({ items: [], nextSyncToken: "fresh-tok" });
    const res = await POST(req({ "x-goog-resource-state": "exists" }) as any);
    expect(res.status).toBe(200);
    expect(mockListEventsDelta).toHaveBeenCalledTimes(2);
    // Second call is without sync token (full re-sync)
    expect(mockListEventsDelta.mock.calls[1]).toHaveLength(2);
    expect(mockProcessCalendarDelta).toHaveBeenCalledOnce();
  });

  it("returns ok without crashing when both delta and re-sync fail", async () => {
    mockListEventsDelta
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { code: 410 }))
      .mockRejectedValueOnce(new Error("also failed"));
    const res = await POST(req({ "x-goog-resource-state": "exists" }) as any);
    expect(res.status).toBe(200);
    expect(mockProcessCalendarDelta).not.toHaveBeenCalled();
  });

  it("returns ok without crashing on non-410 listEventsDelta error", async () => {
    mockListEventsDelta.mockRejectedValue(Object.assign(new Error("server error"), { code: 500 }));
    const res = await POST(req({ "x-goog-resource-state": "exists" }) as any);
    expect(res.status).toBe(200);
    expect(mockProcessCalendarDelta).not.toHaveBeenCalled();
  });
});
