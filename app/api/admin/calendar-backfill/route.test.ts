import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "fake-client-id",
    GOOGLE_CLIENT_SECRET: "fake-client-secret",
  },
}));

const mockSession: Record<string, unknown> = { isAdmin: true, save: vi.fn() };
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));

const mockPrepare = vi.fn();
const mockDb: Record<string, unknown> = { prepare: mockPrepare };
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mockDb) }));

vi.mock("@/lib/queries/people", () => ({
  isActivePerson: vi.fn(() => true),
  isOwner: vi.fn(() => false),
}));

const mockGetSetting = vi.fn<(...a: unknown[]) => string>();
vi.mock("@/lib/queries/settings", () => ({
  getSetting: (...a: unknown[]) => mockGetSetting(...a),
}));

const mockSyncReservationCreate = vi.fn<(...a: unknown[]) => Promise<void>>();
vi.mock("@/lib/reservation-sync", () => ({
  syncReservationCreate: (...a: unknown[]) => mockSyncReservationCreate(...a),
}));

import { POST } from "./route";

let ipCounter = 0;
function req() {
  return new Request("http://localhost/api/admin/calendar-backfill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
  // Default: calendar_id + token set, returns no rows
  mockGetSetting.mockImplementation((_, key: unknown) => {
    if (key === "google_calendar_id") return "cal-id";
    if (key === "google_oauth_refresh_token") return "refresh-token";
    return "";
  });
  mockPrepare.mockReturnValue({ all: vi.fn(() => []) });
  mockSyncReservationCreate.mockResolvedValue(undefined);
});

describe("POST /api/admin/calendar-backfill", () => {
  it("returns 403 for non-admin", async () => {
    mockSession.isAdmin = false;
    const res = await POST(req());
    expect(res.status).toBe(403);
  });

  it("returns error when no calendar_id setting", async () => {
    mockGetSetting.mockImplementation((_, key: unknown) => {
      if (key === "google_calendar_id") return "";
      if (key === "google_oauth_refresh_token") return "refresh-token";
      return "";
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "no_calendar_id" });
  });

  it("returns error when no oauth refresh token", async () => {
    mockGetSetting.mockImplementation((_, key: unknown) => {
      if (key === "google_calendar_id") return "cal-id";
      if (key === "google_oauth_refresh_token") return "";
      return "";
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "no_token" });
  });

  it("returns ok with synced=0 when no unsynced reservations", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, synced: 0, failed: 0, total: 0 });
    expect(mockSyncReservationCreate).not.toHaveBeenCalled();
  });

  it("syncs all unsynced upcoming reservations and reports count", async () => {
    mockPrepare.mockReturnValue({ all: vi.fn(() => [{ id: 1 }, { id: 2 }, { id: 3 }]) });
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, synced: 3, failed: 0, total: 3 });
    expect(mockSyncReservationCreate).toHaveBeenCalledTimes(3);
    expect(mockSyncReservationCreate).toHaveBeenCalledWith(mockDb, 1);
    expect(mockSyncReservationCreate).toHaveBeenCalledWith(mockDb, 2);
    expect(mockSyncReservationCreate).toHaveBeenCalledWith(mockDb, 3);
  });

  it("counts failed reservations when syncReservationCreate throws", async () => {
    mockPrepare.mockReturnValue({ all: vi.fn(() => [{ id: 10 }, { id: 11 }]) });
    mockSyncReservationCreate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Google API error"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, synced: 1, failed: 1, total: 2 });
  });
});
