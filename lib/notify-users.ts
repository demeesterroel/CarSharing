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

/** Driver/member pref column per trigger ('all' = notify about others' events). */
const DRIVER_COLUMN: Record<NotifyTrigger, string> = {
  new_reservation: "notify_new_reservations",
  reservation_update: "notify_reservation_updates",
  new_trip: "notify_new_trips",
};

/** Owner toggle column per trigger ('on' = notify about events on cars I own). */
const OWNER_COLUMN: Record<NotifyTrigger, string> = {
  new_reservation: "notify_my_car_reservations",
  reservation_update: "notify_my_car_reservations",
  new_trip: "notify_my_car_trips",
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
 * Recipient rules (active people only, actor always excluded):
 *  - driver pref = 'all' → notified about everyone's events of this type
 *  - owner toggle = 'on' AND owns `carId` → notified about events on their car
 *  - alwaysNotifyPersonId (e.g. the reserver) → notified regardless of prefs
 *  Recipients are de-duplicated; the reserver gets `alwaysNotifyMessage`.
 */
export async function notifyUsersOfEvent(opts: NotifyUsersOptions): Promise<void> {
  try {
    const driverColumn = DRIVER_COLUMN[opts.trigger];
    const ownerColumn = OWNER_COLUMN[opts.trigger];

    // Driver/member recipients: opted into all events of this type (self excluded).
    const driverRecipients = opts.db
      .prepare(
        `SELECT id FROM people
         WHERE active = 1 AND id != ? AND ${driverColumn} = 'all'`
      )
      .all(opts.actorPersonId) as { id: number }[];

    // Owner recipients: own the car AND opted into events on their car (self excluded).
    const ownerRecipients = opts.db
      .prepare(
        `SELECT p.id FROM people p
         INNER JOIN cars c ON c.owner_person_id = p.id
         WHERE p.active = 1 AND p.id != ? AND p.${ownerColumn} = 'on' AND c.id = ?`
      )
      .all(opts.actorPersonId, opts.carId) as { id: number }[];

    const recipientIds = new Set<number>([
      ...driverRecipients.map((r) => r.id),
      ...ownerRecipients.map((r) => r.id),
    ]);

    // Always-notify recipient (e.g. the reserver, told their own reservation was
    // approved/rejected/deleted). Sent regardless of the 'mine'/'all' choice, but
    // NOT when they are the actor, and NOT when they fully opted out ('off' on the
    // trigger's driver column — e.g. notify_reservation_updates='off' means no
    // reservation-update notifications at all, not even your own outcome).
    // The Set de-duplicates against opt-in recipients.
    if (opts.alwaysNotifyPersonId != null && opts.alwaysNotifyPersonId !== opts.actorPersonId) {
      const pref = opts.db
        .prepare(`SELECT ${driverColumn} AS v FROM people WHERE id = ? AND active = 1`)
        .get(opts.alwaysNotifyPersonId) as { v: string } | undefined;
      if (pref && pref.v !== "off") {
        recipientIds.add(opts.alwaysNotifyPersonId);
      }
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
