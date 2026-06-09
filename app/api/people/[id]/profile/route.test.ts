// app/api/people/[id]/profile/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/env", () => ({
  env: { SESSION_PASSWORD: "test-password-32-chars-minimum!!", NODE_ENV: "test" },
}));

const CSRF = "test-csrf-token";

const mockSession = {
  authenticated: true,
  personId: 1,
  isAdmin: false,
  save: vi.fn(),
};

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetPersonById = vi.fn();
const mockUpdatePerson = vi.fn();
vi.mock("@/lib/queries/people", () => ({
  getPersonById: (...args: unknown[]) => mockGetPersonById(...args),
  updatePerson: (...args: unknown[]) => mockUpdatePerson(...args),
}));

const existingPerson = {
  id: 1,
  first_name: "Alice",
  last_name: "",
  username: "alice",
  bank_account: "",
  email: null,
  theme_preference: "mono" as const,
  is_admin: 0,
  active: 1,
  discount: 0,
  discount_long: 0,
  updated_at: "",
};

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: unknown, method = "PATCH") {
  return new Request(`http://localhost/api/people/1/profile`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `csrf-token=${CSRF}`,
      "x-csrf-token": CSRF,
    },
    body: JSON.stringify(body),
  });
}

const validBody = { first_name: "Alice", last_name: "", bank_account: "" };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.authenticated = true;
  mockSession.personId = 1;
  mockSession.isAdmin = false;
  mockGetPersonById.mockReturnValue(existingPerson);
  mockUpdatePerson.mockReturnValue(undefined);
});

describe("PATCH /api/people/[id]/profile", () => {
  it("allows person to update their own profile", async () => {
    const res = await PATCH(makeReq(validBody), makeCtx("1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpdatePerson).toHaveBeenCalledOnce();
  });

  it("allows admin to update any person's profile", async () => {
    mockSession.personId = 99;
    mockSession.isAdmin = true;
    const res = await PATCH(makeReq(validBody), makeCtx("1"));
    expect(res.status).toBe(200);
    expect(mockUpdatePerson).toHaveBeenCalledOnce();
  });

  it("returns 403 when non-admin edits another person", async () => {
    mockSession.personId = 2;
    mockSession.isAdmin = false;
    const res = await PATCH(makeReq(validBody), makeCtx("1"));
    expect(res.status).toBe(403);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 403 when unauthenticated", async () => {
    mockSession.authenticated = false;
    mockSession.personId = undefined as unknown as number;
    const res = await PATCH(makeReq(validBody), makeCtx("1"));
    expect(res.status).toBe(403);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 404 when person does not exist", async () => {
    mockGetPersonById.mockReturnValue(undefined);
    const res = await PATCH(makeReq(validBody), makeCtx("1"));
    expect(res.status).toBe(404);
    expect(mockUpdatePerson).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF token is missing", async () => {
    const req = new Request("http://localhost/api/people/1/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await PATCH(req, makeCtx("1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "invalid_csrf" });
  });

  it("returns 400 for missing required first_name", async () => {
    const res = await PATCH(makeReq({ last_name: "X" }), makeCtx("1"));
    expect(res.status).toBe(400);
  });

  it("persists theme_preference update", async () => {
    const res = await PATCH(makeReq({ ...validBody, theme_preference: "paper" }), makeCtx("1"));
    expect(res.status).toBe(200);
    const [, , data] = mockUpdatePerson.mock.calls[0];
    expect(data.theme_preference).toBe("paper");
  });
});
