import { env } from "./env";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends a transactional email.
 *
 * Delivery is transport-agnostic so the self-hosted app needs no SMTP library:
 * - If `RESEND_API_KEY` is configured, the message is sent via the Resend API.
 * - If `MAIL_WEBHOOK_URL` is configured, the message is POSTed there as JSON
 *   (point it at a provider/serverless function — Postmark, SES, …).
 * - Otherwise the message is logged so a self-hoster can still retrieve the link
 *   from the server logs. Failures never throw — callers must not leak whether a
 *   recipient exists, and email delivery must not break the request.
 */
export async function sendMail(email: OutgoingEmail): Promise<void> {
  const from = env.MAIL_FROM ?? "noreply@carsharing.local";

  const apiKey = env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
      });
      if (res.ok) return;
      console.error(`[mailer] resend delivery failed: ${res.status}`);
    } catch (e) {
      console.error("[mailer] resend delivery error", e);
    }
  } else if (env.MAIL_WEBHOOK_URL) {
    try {
      const res = await fetch(env.MAIL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...email }),
      });
      if (res.ok) return;
      console.error(`[mailer] webhook delivery failed: ${res.status}`);
    } catch (e) {
      console.error("[mailer] webhook delivery error", e);
    }
  }

  // No transport, or delivery failed: log so a self-hoster can still recover the
  // link from server logs. Never throw — callers must not leak recipient existence.
  console.log(
    `[mailer] no transport configured — would send:\n  to: ${email.to}\n  subject: ${email.subject}\n  ${email.text}`
  );
}

/**
 * True when a real mail transport is configured (Resend or a webhook). UIs use
 * this to decide whether to offer reset / magic-link delivery (#277).
 */
export function isMailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY || env.MAIL_WEBHOOK_URL);
}
