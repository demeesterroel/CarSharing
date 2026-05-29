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
 * - If `MAIL_WEBHOOK_URL` is configured, the message is POSTed there as JSON
 *   (point it at a provider/serverless function — Resend, Postmark, SES, …).
 * - Otherwise the message is logged so a self-hoster can still retrieve the link
 *   from the server logs. Failures never throw — callers must not leak whether a
 *   recipient exists, and email delivery must not break the request.
 */
export async function sendMail(email: OutgoingEmail): Promise<void> {
  const webhook = env.MAIL_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.MAIL_FROM ?? "noreply@carsharing.local", ...email }),
      });
      return;
    } catch (e) {
      console.error("[mailer] webhook delivery failed", e);
    }
  }
  console.log(
    `[mailer] no transport configured — would send:\n  to: ${email.to}\n  subject: ${email.subject}\n  ${email.text}`
  );
}
