// lib/__tests__/notify-admin.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock @/lib/mailer ─────────────────────────────────────────────────────
// Use a factory that references only module-level vi helpers (no outer vars).
vi.mock("@/lib/mailer", () => ({
  isMailEnabled: vi.fn(),
  sendMail: vi.fn(),
}));

// ── Mock @/lib/queries/people ─────────────────────────────────────────────
vi.mock("@/lib/queries/people", () => ({
  getAdminEmails: vi.fn(),
}));

// ── Import mocked modules to control them ─────────────────────────────────
import * as mailer from "@/lib/mailer";
import * as peopleQueries from "@/lib/queries/people";

// ── Import SUT after mocks ─────────────────────────────────────────────────
import { notifyAdminOfChange } from "../notify-admin";

const mockIsMailEnabled = mailer.isMailEnabled as ReturnType<typeof vi.fn>;
const mockSendMail = mailer.sendMail as ReturnType<typeof vi.fn>;
const mockGetAdminEmails = peopleQueries.getAdminEmails as ReturnType<typeof vi.fn>;

// ── Minimal actor shapes ──────────────────────────────────────────────────
const nonAdminActor = {
  personId: 42,
  shortName: "Alice",
  isAdmin: false as boolean | undefined,
};
const adminActor = {
  personId: 1,
  shortName: "Admin",
  isAdmin: true as boolean | undefined,
};

// Fake DB — the function receives it and passes it to getAdminEmails
const fakeDb = {} as import("better-sqlite3").Database;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: sendMail resolves normally
  mockSendMail.mockResolvedValue(undefined);
});

describe("notifyAdminOfChange", () => {
  // ── (1) Skips entirely when mail is not configured ──────────────────────
  it("returns without sending when isMailEnabled() is false", async () => {
    mockIsMailEnabled.mockReturnValue(false);

    await notifyAdminOfChange({
      db: fakeDb,
      actor: nonAdminActor,
      action: "created",
      entity: "trip",
      details: "Car AA · 2026-06-01 · 10 km",
    });

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockGetAdminEmails).not.toHaveBeenCalled();
  });

  // ── (2) Skips when actor is admin ─────────────────────────────────────
  it("returns without sending when actor isAdmin is true", async () => {
    mockIsMailEnabled.mockReturnValue(true);

    await notifyAdminOfChange({
      db: fakeDb,
      actor: adminActor,
      action: "deleted",
      entity: "fuel fill-up",
      details: "€45",
    });

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  // ── (3) Sends with expected subject / recipient ───────────────────────
  it("sends email with correct subject and recipient for a non-admin actor", async () => {
    mockIsMailEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["admin@example.com"]);

    await notifyAdminOfChange({
      db: fakeDb,
      actor: nonAdminActor,
      action: "created",
      entity: "trip",
      details: "Car AA · 2026-06-01 · 10 km",
    });

    expect(mockSendMail).toHaveBeenCalledOnce();
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("admin@example.com");
    expect(call.subject).toBe("[Autodelen] Alice — created trip");
    expect(call.text).toContain("Alice");
    expect(call.text).toContain("created trip");
    expect(call.text).toContain("Car AA · 2026-06-01 · 10 km");
  });

  it("sends to multiple admin recipients as comma-separated addresses", async () => {
    mockIsMailEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["admin1@example.com", "admin2@example.com"]);

    await notifyAdminOfChange({
      db: fakeDb,
      actor: nonAdminActor,
      action: "updated",
      entity: "expense",
      details: "€120",
    });

    expect(mockSendMail).toHaveBeenCalledOnce();
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toContain("admin1@example.com");
    expect(call.to).toContain("admin2@example.com");
  });

  it("skips sending when no admin emails are found in the DB", async () => {
    mockIsMailEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue([]);

    await notifyAdminOfChange({
      db: fakeDb,
      actor: nonAdminActor,
      action: "created",
      entity: "reservation",
      details: "Car AA 2026-06-01 – 2026-06-03",
    });

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  // ── (4) sendMail rejection does not throw out of the helper ─────────────
  it("does not throw when sendMail rejects", async () => {
    mockIsMailEnabled.mockReturnValue(true);
    mockGetAdminEmails.mockReturnValue(["admin@example.com"]);
    mockSendMail.mockRejectedValueOnce(new Error("SMTP down"));

    await expect(
      notifyAdminOfChange({
        db: fakeDb,
        actor: nonAdminActor,
        action: "deleted",
        entity: "trip",
        details: "id=7",
      })
    ).resolves.toBeUndefined();
  });
});
