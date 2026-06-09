import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockSession: Record<string, unknown> = {
  authenticated: true,
  personId: 1,
  isAdmin: true,
  save: vi.fn(),
};
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/queries/people", () => ({
  isActivePerson: vi.fn(() => true),
  isOwner: vi.fn(() => false),
  getSessionEpoch: vi.fn(() => undefined),
  getPeople: vi.fn(() => fakePeopleWithContacts),
  insertPerson: vi.fn(() => 42),
}));

// A realistic person list — admins see email/bank_account, regular users don't
const fakePeopleWithContacts = [
  {
    id: 1,
    first_name: "Alice",
    last_name: "",
    username: "alice",
    email: "alice@example.com",
    bank_account: "BE00 0000 0000 0000",
    active: 1,
    is_admin: 1,
    discount: 0,
    discount_long: 0,
    theme_preference: "mono" as const,
    updated_at: "",
  },
  {
    id: 2,
    first_name: "Bob",
    last_name: "Builder",
    username: "bob",
    email: "bob@example.com",
    bank_account: "BE11 1111 1111 1111",
    active: 1,
    is_admin: 0,
    discount: 0,
    discount_long: 0,
    theme_preference: "paper" as const,
    updated_at: "",
  },
];

import { GET, POST } from "./route";

const ctx = { params: Promise.resolve({}) };

let ipCounter = 0;
function postReq(body: unknown) {
  return new Request("http://localhost/api/people", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

const validPersonBody = {
  first_name: "Charlie",
  last_name: "Smith",
  discount: 0,
  discount_long: 0,
  active: 1,
  is_admin: 0,
  bank_account: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
  mockSession.personId = 1;
});

describe("GET /api/people", () => {
  it("returns 403 for an unauthenticated request", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = undefined;
    const res = await GET(new Request("http://localhost/api/people"), ctx);
    expect(res.status).toBe(403);
  });

  it("returns full list including email and bank_account for admins", async () => {
    const res = await GET(new Request("http://localhost/api/people"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    // Admin sees sensitive fields
    expect(body[0]).toHaveProperty("email", "alice@example.com");
    expect(body[0]).toHaveProperty("bank_account", "BE00 0000 0000 0000");
    expect(body[1]).toHaveProperty("email", "bob@example.com");
  });

  it("strips email and bank_account for non-admin authenticated users", async () => {
    mockSession.isAdmin = false;
    const res = await GET(new Request("http://localhost/api/people"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    // Non-admin must NOT see sensitive fields
    expect(body[0]).not.toHaveProperty("email");
    expect(body[0]).not.toHaveProperty("bank_account");
    expect(body[1]).not.toHaveProperty("email");
    expect(body[1]).not.toHaveProperty("bank_account");
    // But other fields are still present
    expect(body[0]).toHaveProperty("first_name", "Alice");
    expect(body[1]).toHaveProperty("first_name", "Bob");
  });
});

describe("POST /api/people", () => {
  it("creates a person and returns 201 with the new id (admin)", async () => {
    const res = await POST(postReq(validPersonBody), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id", 42);
  });

  it("returns 403 for non-admin", async () => {
    mockSession.isAdmin = false;
    const res = await POST(postReq(validPersonBody), ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 when first_name is missing", async () => {
    const res = await POST(postReq({ last_name: "Smith" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPersonBody),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
  });
});
