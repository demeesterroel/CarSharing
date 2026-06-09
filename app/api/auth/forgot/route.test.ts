// app/api/auth/forgot/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetPersonByEmail = vi.fn<(...a: unknown[]) => unknown>();
const mockCreateAuthToken = vi.fn<(...a: unknown[]) => unknown>();
vi.mock("@/lib/queries/people", () => ({
  getPersonByEmail: (...a: unknown[]) => mockGetPersonByEmail(...a),
  createAuthToken: (...a: unknown[]) => mockCreateAuthToken(...a),
}));

const mockSendMail = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("@/lib/mailer", () => ({ sendMail: (...a: unknown[]) => mockSendMail(...a) }));

import { POST } from "./route";

let ipCounter = 0;
function req(body: unknown, ip?: string) {
  return new Request("http://localhost/api/auth/forgot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? `192.0.2.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPersonByEmail.mockReturnValue(undefined);
});

describe("POST /api/auth/forgot", () => {
  it("creates a reset token and sends mail when the email matches an account", async () => {
    mockGetPersonByEmail.mockReturnValue({ id: 9 });
    const res = await POST(req({ email: "alice@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockCreateAuthToken).toHaveBeenCalledOnce();
    expect(mockCreateAuthToken.mock.calls[0]).toEqual([
      {},
      9,
      expect.any(String),
      expect.any(String),
      "reset",
    ]);
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it("returns 200 without sending when no account matches (no enumeration)", async () => {
    const res = await POST(req({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockCreateAuthToken).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 200 even for invalid input", async () => {
    const res = await POST(req({ email: "not-an-email" }));
    expect(res.status).toBe(200);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("rate-limits repeated requests from the same IP", async () => {
    const ip = "192.0.2.250";
    for (let i = 0; i < 5; i++) {
      const res = await POST(req({ email: "x@example.com" }, ip));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(req({ email: "x@example.com" }, ip));
    expect(blocked.status).toBe(429);
  });
});
