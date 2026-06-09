// app/api/expenses/route.test.ts
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

const mockGetExpenses = vi.fn((..._a: unknown[]) => [{ id: 1 }]);
const mockGetExpenseById = vi.fn((..._a: unknown[]) => ({ id: 7 }));
const mockInsertExpense = vi.fn((..._a: unknown[]) => 7);
vi.mock("@/lib/queries/expenses", () => ({
  getExpenses: (...a: unknown[]) => mockGetExpenses(...a),
  getExpenseById: (...a: unknown[]) => mockGetExpenseById(...a),
  insertExpense: (...a: unknown[]) => mockInsertExpense(...a),
}));

import { GET, POST } from "./route";

const CSRF = "test-csrf-token";
const ctx = { params: Promise.resolve({}) };

let ipCounter = 0;
function postReq(body: unknown) {
  return new Request("http://localhost/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}
function getReq() {
  return new Request("http://localhost/api/expenses");
}

const validExpense = {
  person_id: 1,
  car_id: 2,
  date: "2025-01-15",
  amount: 120.0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetExpenses.mockReturnValue([{ id: 1 }]);
  mockGetExpenseById.mockReturnValue({ id: 7 });
  mockInsertExpense.mockReturnValue(7);
});

describe("GET /api/expenses", () => {
  it("returns the expense list for an authenticated member", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
    expect(mockGetExpenses).toHaveBeenCalledOnce();
  });

  it("returns 403 for an unauthenticated request", async () => {
    mockSession.personId = undefined as unknown as number;
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
    expect(mockGetExpenses).not.toHaveBeenCalled();
  });
});

describe("POST /api/expenses", () => {
  it("creates an expense and returns the inserted record with 201", async () => {
    const res = await POST(postReq(validExpense), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 7 });
    expect(mockInsertExpense).toHaveBeenCalledOnce();
    expect(mockGetExpenseById).toHaveBeenCalledWith({}, 7);
  });

  it("accepts optional category and passes client_id through", async () => {
    const res = await POST(
      postReq({ ...validExpense, category: "onderhoud", client_id: "ref-789" }),
      ctx
    );
    expect(res.status).toBe(201);
    const [, insertedData] = mockInsertExpense.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(insertedData.category).toBe("onderhoud");
    expect(insertedData.client_id).toBe("ref-789");
  });

  it("returns 400 for an invalid body (missing required fields)", async () => {
    const res = await POST(postReq({ person_id: 1 }), ctx);
    expect(res.status).toBe(400);
    expect(mockInsertExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid category value", async () => {
    const res = await POST(postReq({ ...validExpense, category: "bogus-category" }), ctx);
    expect(res.status).toBe(400);
    expect(mockInsertExpense).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${++ipCounter}`,
      },
      body: JSON.stringify(validExpense),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
    expect(mockInsertExpense).not.toHaveBeenCalled();
  });
});
