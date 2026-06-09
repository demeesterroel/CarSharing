/**
 * lib/notify-admin.ts
 *
 * Fire-and-forget notification helper: emails all active admin users when a
 * non-admin user creates, updates, or deletes a record.
 *
 * Recipient resolution:
 *   By default, recipients are all active people with `is_admin=1` and a
 *   non-empty email address (via `getAdminEmails`).  If the env var
 *   `ADMIN_NOTIFY_EMAIL` is set it overrides the DB lookup entirely, which is
 *   useful when the admin account in the DB has no email configured.
 *
 * The call never throws — any sendMail failure is swallowed so the API
 * response path is unaffected.
 */

import type Database from "better-sqlite3";
import { isMailEnabled, sendMail } from "@/lib/mailer";
import { getAdminEmails } from "@/lib/queries/people";

export interface NotifyAdminOptions {
  db: Database.Database;
  actor: {
    personId?: number;
    shortName?: string;
    isAdmin?: boolean;
  };
  /** e.g. "created" | "updated" | "deleted" */
  action: string;
  /** e.g. "trip" | "fuel fill-up" | "expense" | "reservation" */
  entity: string;
  /** A human-readable summary of the key fields (plain text, one or more lines). */
  details: string;
}

/**
 * Sends a notification email to all admin recipients when a non-admin user
 * mutates data.  Call this after a successful DB write — the result is always
 * `Promise<void>` and never throws.
 */
export async function notifyAdminOfChange(opts: NotifyAdminOptions): Promise<void> {
  // Gate 1: only send when a mail transport is configured.
  if (!isMailEnabled()) return;

  // Gate 2: never notify when the acting user is an admin.
  if (opts.actor.isAdmin) return;

  const actorName = opts.actor.shortName ?? `person #${opts.actor.personId ?? "?"}`;

  // Resolve recipients: env override takes priority over DB lookup.
  let recipients: string[];
  const envOverride = process.env.ADMIN_NOTIFY_EMAIL;
  if (envOverride) {
    recipients = [envOverride];
  } else {
    recipients = getAdminEmails(opts.db);
  }

  if (recipients.length === 0) return;

  const subject = `[Autodelen] ${actorName} — ${opts.action} ${opts.entity}`;

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const text = [
    `${actorName} — ${opts.action} ${opts.entity}`,
    "",
    `Details:`,
    opts.details,
    "",
    `Timestamp: ${timestamp}`,
  ].join("\n");

  await sendMail({ to: recipients.join(", "), subject, text }).catch(() => {
    /* swallow — failures must never affect the API response */
  });
}
