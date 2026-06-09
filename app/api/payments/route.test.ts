// app/api/payments/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const mockSession = {
  authenticated: true,
  personId: 1,
  isAdmin: false,
  save: vi.fn(),
};
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mockSession) }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/queries/people", () => ({ isActivePerson: vi.fn(() => true) }));

const mockGetPayments = vi.fn((..._a: unknown[]) => [{ id: 1 }]);
const mockInsertPayment = vi.fn((..._a: unknown[]) => 7);
vi.mock("@/lib/queries/payments", () => ({
  getPayments: (...a: unknown[]) => mockGetPayments(...a),
  insertPayment: (...a: unknown[]) => mockInsertPayment(...a),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

function getReq() {
  return new Request("http://localhost/api/payments");
}
function postReq(body: unknown) {
  return new Request("http://localhost/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
    },
    body: JSON.stringify(body),
  });
}
const validPayment = { person_id: 2, date: "2025-01-01", amount: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
});

describe("GET /api/payments", () => {
  it("returns 403 for a non-admin member", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetPayments).not.toHaveBeenCalled();
  });

  it("returns the payment list for an admin", async () => {
    mockSession.isAdmin = true;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
  });
});

describe("POST /api/payments", () => {
  it("returns 403 for a non-admin member and does not insert", async () => {
    const res = await POST(postReq(validPayment), ctx);
    expect(res.status).toBe(403);
    expect(mockInsertPayment).not.toHaveBeenCalled();
  });

  it("creates the payment for an admin", async () => {
    mockSession.isAdmin = true;
    const res = await POST(postReq(validPayment), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 7 });
    expect(mockInsertPayment).toHaveBeenCalledOnce();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockSession.isAdmin = true;
    const req = new Request("http://localhost/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayment),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertPayment).not.toHaveBeenCalled();
  });
});
