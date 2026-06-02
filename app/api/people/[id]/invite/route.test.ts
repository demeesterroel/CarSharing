import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    SESSION_PASSWORD: "test-password-32-chars-minimum!!",
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  },
}));

const mockSession: Record<string, unknown> = { isAdmin: true };
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => mockSession),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetPersonById = vi.fn<(...a: unknown[]) => unknown>();
const mockCreateInviteToken = vi.fn<(...a: unknown[]) => unknown>();
vi.mock("@/lib/queries/people", () => ({
  getPersonById: (...a: unknown[]) => mockGetPersonById(...a),
  createInviteToken: (...a: unknown[]) => mockCreateInviteToken(...a),
}));

const mockSendMail = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let mailEnabled = true;
vi.mock("@/lib/mailer", () => ({
  sendMail: (...a: unknown[]) => mockSendMail(...a),
  isMailEnabled: () => mailEnabled,
}));

import { POST } from "./route";

let ipCounter = 0;
function req(body: unknown) {
  return new Request("http://localhost/api/people/5/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The json() wrapper enforces the CSRF double-submit on POST.
      cookie: "csrf-token=t",
      "x-csrf-token": "t",
      "x-forwarded-for": `203.0.113.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.isAdmin = true;
  mailEnabled = true;
  mockGetPersonById.mockReturnValue({ id: 5, email: "member@example.com", username: "alice" });
});

describe("POST /api/people/[id]/invite", () => {
  it("returns a copyable url when send is not requested", async () => {
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/\/invite\/[a-f0-9]+$/);
    expect(mockCreateInviteToken).toHaveBeenCalledOnce();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("emails the invite when send=true and the member has an email + mail is enabled", async () => {
    const res = await POST(req({ send: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(mockCreateInviteToken).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledOnce();
    const mail = mockSendMail.mock.calls[0][0] as { to: string; text: string };
    expect(mail.to).toBe("member@example.com");
    expect(mail.text).toContain("Your username: alice");
  });

  it("returns 400 when send=true but the member has no email", async () => {
    mockGetPersonById.mockReturnValue({ id: 5, email: null });
    const res = await POST(req({ send: true }), ctx);
    expect(res.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockCreateInviteToken).not.toHaveBeenCalled();
  });

  it("returns 400 when send=true but mail is not configured", async () => {
    mailEnabled = false;
    const res = await POST(req({ send: true }), ctx);
    expect(res.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockCreateInviteToken).not.toHaveBeenCalled();
  });

  it("returns 400 when the member has no username (can't log in otherwise)", async () => {
    mockGetPersonById.mockReturnValue({ id: 5, email: "member@example.com", username: null });
    const res = await POST(req({ send: true }), ctx);
    expect(res.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockCreateInviteToken).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admins", async () => {
    mockSession.isAdmin = false;
    const res = await POST(req({ send: true }), ctx);
    expect(res.status).toBe(403);
  });
});
