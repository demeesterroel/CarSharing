// app/api/expenses/[id]/route.test.ts
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

const mockGetCarById = vi.fn();
vi.mock("@/lib/queries/cars", () => ({
  getCarById: (...a: unknown[]) => mockGetCarById(...a),
}));

// Existing record: created by person 2, car_id 10.
const existingExpense = { id: 5, person_id: 2, car_id: 10 };

const mockGetExpenseById = vi.fn();
const mockUpdateExpense = vi.fn();
const mockDeleteExpense = vi.fn();
vi.mock("@/lib/queries/expenses", () => {
  class ConflictError extends Error {}
  return {
    getExpenseById: (...a: unknown[]) => mockGetExpenseById(...a),
    updateExpense: (...a: unknown[]) => mockUpdateExpense(...a),
    deleteExpense: (...a: unknown[]) => mockDeleteExpense(...a),
    ConflictError,
  };
});

import { ConflictError } from "@/lib/queries/expenses";
import { DELETE, GET, PUT } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({ id: "5" }) };

let ipCounter = 0;
function mutReq(method: "PUT" | "DELETE", body?: unknown) {
  return new Request("http://localhost/api/expenses/5", {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
function getReq() {
  return new Request("http://localhost/api/expenses/5");
}

const validExpense = {
  person_id: 2,
  car_id: 10,
  date: "2025-01-15",
  amount: 120.0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.personId = 1;
  mockSession.isAdmin = true;
  mockGetExpenseById.mockReturnValue(existingExpense);
  mockGetCarById.mockReturnValue({ id: 10, owner_person_id: 99 });
});

describe("GET /api/expenses/[id]", () => {
  it("returns the expense for an authenticated member", async () => {
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existingExpense);
    expect(mockGetExpenseById).toHaveBeenCalledWith({}, 5);
  });

  it("returns 404 when the expense does not exist", async () => {
    mockGetExpenseById.mockReturnValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    mockSession.isAdmin = false;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetExpenseById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/expenses/[id]", () => {
  it("updates the expense and returns ok when the user is an admin", async () => {
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdateExpense).toHaveBeenCalledWith(
      {},
      5,
      expect.objectContaining({ person_id: 2 }),
      expect.any(Object)
    );
  });

  it("allows the record creator (person_id 2) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2;
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateExpense).toHaveBeenCalledOnce();
  });

  it("allows the car owner (person_id 99) to update", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 99;
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateExpense).toHaveBeenCalledOnce();
  });

  it("returns 403 for a user who is not admin, creator, or car owner", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(403);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense does not exist", async () => {
    mockGetExpenseById.mockReturnValue(null);
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const res = await PUT(mutReq("PUT", { person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("returns 409 when updateExpense throws ConflictError", async () => {
    mockUpdateExpense.mockImplementation(() => {
      throw new ConflictError("stale");
    });
    const res = await PUT(mutReq("PUT", validExpense), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "stale" });
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/expenses/5", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validExpense),
    });
    const res = await PUT(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/expenses/[id]", () => {
  it("deletes the expense when the user is an admin", async () => {
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(mockDeleteExpense).toHaveBeenCalledWith({}, 5);
  });

  it("allows the record creator to delete", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(mockDeleteExpense).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthorized user", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 42;
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(403);
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense does not exist", async () => {
    mockGetExpenseById.mockReturnValue(null);
    const res = await DELETE(mutReq("DELETE"), ctx);
    expect(res.status).toBe(404);
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/expenses/5", {
      method: "DELETE",
      headers: { "x-forwarded-for": `203.0.113.${++ipCounter}` },
    });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });
});
