import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));

// Default: unauthenticated session. Individual tests can override.
const mockGetIronSession = vi.fn(async () => ({ authenticated: false }) as Record<string, unknown>);
vi.mock("iron-session", () => ({
  getIronSession: (...a: unknown[]) => mockGetIronSession(...(a as [])),
}));

import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function reqFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIronSession.mockResolvedValue({ authenticated: false });
});

describe("proxy auth gating", () => {
  it("lets the Google calendar webhook through unauthenticated (public path)", async () => {
    // Regression for #339: the webhook POST carries no session cookie. If proxy
    // redirects it to /login, all inbound Google Calendar sync is dead.
    const res = await proxy(reqFor("/api/calendar-webhook"));
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated protected route to /login", async () => {
    const res = await proxy(reqFor("/api/reservations"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
