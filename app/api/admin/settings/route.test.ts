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

const mockSession: Record<string, unknown> = { isAdmin: true, personId: 1, save: vi.fn() };
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/queries/people", () => ({
  isActivePerson: vi.fn(() => true),
  isOwner: vi.fn(() => false),
  getSessionEpoch: vi.fn(() => undefined),
}));

const mockGetSetting = vi.fn<(...a: unknown[]) => string>();
const mockSetSetting = vi.fn<(...a: unknown[]) => void>();
vi.mock("@/lib/queries/settings", () => ({
  getSetting: (...a: unknown[]) => mockGetSetting(...a),
  setSetting: (...a: unknown[]) => mockSetSetting(...a),
}));

import { GET, PUT } from "./route";

let ipCounter = 0;
function getReq() {
  return new Request("http://localhost/api/admin/settings", {
    method: "GET",
    headers: {
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
  });
}

function putReq(body: unknown) {
  return new Request("http://localhost/api/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
  mockSession.personId = 1;
  mockGetSetting.mockImplementation((_, key: unknown) => {
    if (key === "coop_bank_account") return "BE12 3456 7890";
    if (key === "google_calendar_id") return "cal-id";
    if (key === "google_oauth_refresh_token") return "refresh-token";
    return "";
  });
});

describe("GET /api/admin/settings", () => {
  it("returns 403 for non-admin, non-owner", async () => {
    mockSession.isAdmin = false;
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("returns settings for an admin", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      coop_bank_account: "BE12 3456 7890",
      google_calendar_id: "cal-id",
      google_oauth_refresh_token: "refresh-token",
      env_credentials_ok: true,
    });
  });
});

describe("PUT /api/admin/settings", () => {
  it("returns 403 for non-admin", async () => {
    mockSession.isAdmin = false;
    const res = await PUT(putReq({ coop_bank_account: "BE99" }));
    expect(res.status).toBe(403);
  });

  it("saves provided settings and returns ok:true", async () => {
    const res = await PUT(putReq({ coop_bank_account: "BE99 1111 2222", google_calendar_id: "new-cal" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockSetSetting).toHaveBeenCalledWith(expect.anything(), "coop_bank_account", "BE99 1111 2222");
    expect(mockSetSetting).toHaveBeenCalledWith(expect.anything(), "google_calendar_id", "new-cal");
  });

  it("only sets provided fields (omitted keys are not written)", async () => {
    const res = await PUT(putReq({ google_oauth_refresh_token: "new-token" }));
    expect(res.status).toBe(200);
    expect(mockSetSetting).toHaveBeenCalledTimes(1);
    expect(mockSetSetting).toHaveBeenCalledWith(
      expect.anything(),
      "google_oauth_refresh_token",
      "new-token"
    );
  });

  it("returns 400 on invalid body (value too long)", async () => {
    const tooLong = "x".repeat(201);
    const res = await PUT(putReq({ coop_bank_account: tooLong }));
    expect(res.status).toBe(400);
    expect(mockSetSetting).not.toHaveBeenCalled();
  });
});
