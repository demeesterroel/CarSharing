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
  getPersonById: (...a: unknown[]) => mockGetPersonById(...a),
  updatePerson: (...a: unknown[]) => mockUpdatePerson(...a),
}));

const mockGetPersonById = vi.fn();
const mockUpdatePerson = vi.fn();

const existingPerson = {
  id: 5,
  first_name: "Alice",
  last_name: "",
  username: "alice",
  bank_account: "",
  email: "alice@example.com",
  theme_preference: "mono" as const,
  is_admin: 0,
  active: 1,
  discount: 0,
  discount_long: 0,
  updated_at: "",
};

import { GET, PUT } from "./route";

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

let ipCounter = 0;
function putReq(body: unknown) {
  return new Request("http://localhost/api/people/5", {
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

const validBody = {
  first_name: "Alice",
  last_name: "Updated",
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
  mockGetPersonById.mockReturnValue(existingPerson);
  mockUpdatePerson.mockReturnValue(undefined);
});

describe("GET /api/people/[id]", () => {
  it("returns the full row (incl. email + bank_account) for an admin", async () => {
    mockSession.isAdmin = true;
    mockSession.personId = 99; // not the record owner, but admin
    const res = await GET(new Request("http://localhost/api/people/5"), makeCtx("5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 5, first_name: "Alice" });
    expect(body.email).toBe("alice@example.com");
    expect(body).toHaveProperty("bank_account");
    expect(mockGetPersonById).toHaveBeenCalledWith({}, 5);
  });

  it("returns the full row for a member requesting their OWN id", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 5; // owns record 5
    const res = await GET(new Request("http://localhost/api/people/5"), makeCtx("5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("alice@example.com");
    expect(body).toHaveProperty("bank_account");
  });

  it("strips email + bank_account for a member requesting ANOTHER id", async () => {
    mockSession.isAdmin = false;
    mockSession.personId = 2; // different person
    const res = await GET(new Request("http://localhost/api/people/5"), makeCtx("5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("bank_account");
    expect(body).toMatchObject({ id: 5, first_name: "Alice" });
  });

  it("returns 403 when unauthenticated", async () => {
    mockSession.authenticated = false;
    mockSession.personId = undefined;
    mockSession.isAdmin = false;
    const res = await GET(new Request("http://localhost/api/people/5"), makeCtx("5"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the person does not exist", async () => {
    mockGetPersonById.mockReturnValue(null);
    const res = await GET(new Request("http://localhost/api/people/99"), makeCtx("99"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await GET(new Request("http://localhost/api/people/abc"), makeCtx("abc"));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/people/[id]", () => {
  it("updates a person and returns ok (admin)", async () => {
    const res = await PUT(putReq(validBody), makeCtx("5"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdatePerson).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-admin", async () => {
    mockSession.isAdmin = false;
    const res = await PUT(putReq(validBody), makeCtx("5"));
    expect(res.status).toBe(403);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 404 when the person does not exist", async () => {
    mockGetPersonById.mockReturnValue(null);
    const res = await PUT(putReq(validBody), makeCtx("5"));
    expect(res.status).toBe(404);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 400 when first_name is missing", async () => {
    const res = await PUT(putReq({ last_name: "X" }), makeCtx("5"));
    expect(res.status).toBe(400);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/people/5", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await PUT(req, makeCtx("5"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
  });
});
