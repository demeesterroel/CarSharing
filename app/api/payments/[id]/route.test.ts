// app/api/payments/[id]/route.test.ts
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

const mockGetPaymentById = vi.fn((..._a: unknown[]) => ({ id: 5, amount: 100 }));
const mockUpdatePayment = vi.fn();
const mockDeletePayment = vi.fn();
vi.mock("@/lib/queries/payments", () => ({
  getPaymentById: (...a: unknown[]) => mockGetPaymentById(...a),
  updatePayment: (...a: unknown[]) => mockUpdatePayment(...a),
  deletePayment: (...a: unknown[]) => mockDeletePayment(...a),
}));

import { DELETE, GET, PUT } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

function getReq() {
  return new Request("http://localhost/api/payments/5");
}
function putReq(body: unknown) {
  return new Request("http://localhost/api/payments/5", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
    },
    body: JSON.stringify(body),
  });
}
function deleteReq(withCsrf = true) {
  return new Request("http://localhost/api/payments/5", {
    method: "DELETE",
    headers: withCsrf ? { Cookie: `csrf-token=${CSRF}`, "x-csrf-token": CSRF } : {},
  });
}

const validPayment = { person_id: 2, date: "2025-01-01", amount: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetPaymentById.mockReturnValue({ id: 5, amount: 100 });
});

describe("GET /api/payments/[id]", () => {
  it("returns 403 for a non-admin member", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetPaymentById).not.toHaveBeenCalled();
  });

  it("returns the payment for an admin", async () => {
    mockSession.isAdmin = true;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 5, amount: 100 });
    expect(mockGetPaymentById).toHaveBeenCalledOnce();
  });

  it("returns 404 when payment does not exist", async () => {
    mockSession.isAdmin = true;
    mockGetPaymentById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/payments/[id]", () => {
  it("returns 403 for a non-admin member", async () => {
    const res = await PUT(putReq(validPayment), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });

  it("updates the payment for an admin", async () => {
    mockSession.isAdmin = true;
    const res = await PUT(putReq(validPayment), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdatePayment).toHaveBeenCalledOnce();
  });

  it("returns 400 for an invalid body (missing amount)", async () => {
    mockSession.isAdmin = true;
    const res = await PUT(putReq({ person_id: 2, date: "2025-01-01" }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockSession.isAdmin = true;
    const req = new Request("http://localhost/api/payments/5", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayment),
    });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdatePayment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/payments/[id]", () => {
  it("returns 403 for a non-admin member", async () => {
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockDeletePayment).not.toHaveBeenCalled();
  });

  it("deletes the payment for an admin", async () => {
    mockSession.isAdmin = true;
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDeletePayment).toHaveBeenCalledOnce();
  });

  it("rejects a mutation without a CSRF token", async () => {
    mockSession.isAdmin = true;
    const res = await DELETE(deleteReq(false), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeletePayment).not.toHaveBeenCalled();
  });
});
