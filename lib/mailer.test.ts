import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable fake env shared by all cases. lib/mailer imports `./env`, which
// resolves to the same module id as `@/lib/env`, so this single mock covers it.
vi.mock("@/lib/env", () => {
  const mockEnv: Record<string, string | undefined> = {};
  return { env: mockEnv };
});

// Import after mock is set up
import * as mailerModule from "./mailer";
const { sendMail, isMailEnabled } = mailerModule;

// Get reference to mocked env for test mutations
import { env } from "@/lib/env";

const msg = { to: "a@b.com", subject: "Hi", text: "body" };

beforeEach(() => {
  Object.keys(env).forEach((k) => {
    delete env[k];
  });
  vi.clearAllMocks();
});

describe("isMailEnabled", () => {
  it("is true when RESEND_API_KEY is set", () => {
    env.RESEND_API_KEY = "re_x";
    expect(isMailEnabled()).toBe(true);
  });

  it("is true when MAIL_WEBHOOK_URL is set", () => {
    env.MAIL_WEBHOOK_URL = "https://hook.example/mail";
    expect(isMailEnabled()).toBe(true);
  });

  it("is false when neither is set", () => {
    expect(isMailEnabled()).toBe(false);
  });
});
