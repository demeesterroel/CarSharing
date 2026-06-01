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

describe("sendMail", () => {
  it("POSTs to the Resend API with bearer auth when RESEND_API_KEY is set", async () => {
    env.RESEND_API_KEY = "re_test";
    env.MAIL_FROM = "noreply@autodelen.example";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await sendMail(msg);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init!.body as string)).toEqual({
      from: "noreply@autodelen.example",
      to: "a@b.com",
      subject: "Hi",
      text: "body",
    });
  });

  it("falls back to the webhook when only MAIL_WEBHOOK_URL is set", async () => {
    env.MAIL_WEBHOOK_URL = "https://hook.example/mail";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await sendMail(msg);

    expect(fetchMock.mock.calls[0][0]).toBe("https://hook.example/mail");
  });

  it("does not fetch and does not throw when no transport is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(sendMail(msg)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Resend delivery fails", async () => {
    env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(sendMail(msg)).resolves.toBeUndefined();
  });

  it("does not throw when the webhook responds non-ok", async () => {
    env.MAIL_WEBHOOK_URL = "https://hook.example/mail";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 500 }));
    await expect(sendMail(msg)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
