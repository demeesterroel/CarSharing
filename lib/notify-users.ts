/**
 * lib/notify-users.ts
 *
 * In-app notification generation helper.
 *
 * Inserts notification rows for all eligible recipients based on their
 * per-person notification preferences and car ownership.
 *
 * The call never throws — any error is swallowed so the invoking mutation
 * path is always unaffected.
 */

import type Database from "better-sqlite3";
import { insertNotification } from "@/lib/queries/notifications";

export type NotifyTrigger = "new_reservation" | "reservation_update" | "new_trip";

/** Maps a trigger to the people.notify_* column name. */
const TRIGGER_TO_COLUMN: Record<NotifyTrigger, string> = {
  new_reservation: "notify_new_reservations",
  reservation_update: "notify_reservation_updates",
  new_trip: "notify_new_trips",
};

export interface NotifyUsersOptions {
  db: Database.Database;
  trigger: NotifyTrigger;
  entityType: string;
  entityId: number;
  /** The car involved in the event — used to resolve 'own' recipients. */
  carId: number;
  /** The person performing the action; always excluded from recipients. */
  actorPersonId: number;
  /**
   * A person who must be notified regardless of their preferences — e.g. the
   * reserver, told their reservation was approved/rejected/deleted. Still
   * excluded if they are the actor; de-duplicated against opt-in recipients.
   */
  alwaysNotifyPersonId?: number | null;
  message: string;
  /**
   * Message for `alwaysNotifyPersonId` only (e.g. "Your reservation …" addressed
   * to the reserver). Falls back to `message` when not set.
   */
  alwaysNotifyMessage?: string;
}

/**
 * Determines which active people should receive an in-app notification for
 * the event and inserts one row per recipient.
 *
 * Recipient rules:
 *  - pref = 'all'  → always included (unless they are the actor)
 *  - pref = 'own'  → only if they own `carId` (via cars.owner_person_id)
 *  - pref = 'off'  → never included
 *  - inactive people → never included
 *  - actorPersonId → always excluded
 */
export async function notifyUsersOfEvent(opts: NotifyUsersOptions): Promise<void> {
  try {
    const prefColumn = TRIGGER_TO_COLUMN[opts.trigger];

    // Recipients with pref = 'all' (active, not the actor)
    const allRecipients = opts.db
      .prepare(
        `SELECT id FROM people
         WHERE active = 1
           AND id != ?
           AND ${prefColumn} = 'all'`
      )
      .all(opts.actorPersonId) as { id: number }[];

    // Recipients with pref = 'own' who own the car (active, not the actor)
    const ownRecipients = opts.db
      .prepare(
        `SELECT p.id FROM people p
         INNER JOIN cars c ON c.owner_person_id = p.id
         WHERE p.active = 1
           AND p.id != ?
           AND p.${prefColumn} = 'own'
           AND c.id = ?`
      )
      .all(opts.actorPersonId, opts.carId) as { id: number }[];

    // De-duplicate (a person can't appear in both since pref is a single value)
    const recipientIds = new Set<number>([
      ...allRecipients.map((r) => r.id),
      ...ownRecipients.map((r) => r.id),
    ]);

    // Always-notify recipient (e.g. the reserver) — regardless of prefs, but not
    // when they are the actor; the Set de-duplicates against opt-in recipients.
    if (opts.alwaysNotifyPersonId != null && opts.alwaysNotifyPersonId !== opts.actorPersonId) {
      recipientIds.add(opts.alwaysNotifyPersonId);
    }

    for (const recipientPersonId of recipientIds) {
      const message =
        opts.alwaysNotifyMessage != null && recipientPersonId === opts.alwaysNotifyPersonId
          ? opts.alwaysNotifyMessage
          : opts.message;
      insertNotification(opts.db, {
        recipientPersonId,
        type: opts.trigger,
        entityType: opts.entityType,
        entityId: opts.entityId,
        message,
      });
    }
  } catch {
    // Swallow — notification failures must never affect the calling mutation.
  }
}
