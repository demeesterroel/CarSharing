import type { Notification } from "@/types";
import type Database from "better-sqlite3";

export interface InsertNotificationInput {
  recipientPersonId: number;
  type: string;
  entityType: string;
  entityId: number;
  message: string;
}

/**
 * Inserts a new notification record and returns the new row's id.
 */
export function insertNotification(
  db: Database.Database,
  input: InsertNotificationInput
): number {
  const result = db
    .prepare(
      `INSERT INTO notifications (recipient_person_id, type, entity_type, entity_id, message)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.recipientPersonId, input.type, input.entityType, input.entityId, input.message);
  return result.lastInsertRowid as number;
}

/**
 * Lists notifications for a recipient, newest first, up to `limit` rows.
 */
export function listNotifications(
  db: Database.Database,
  personId: number,
  limit = 50
): Notification[] {
  return db
    .prepare(
      `SELECT id, recipient_person_id, type, entity_type, entity_id, message, read_at, created_at
       FROM notifications
       WHERE recipient_person_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(personId, limit) as Notification[];
}

/**
 * Returns the number of unread notifications for a recipient.
 */
export function unreadCount(db: Database.Database, personId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM notifications
       WHERE recipient_person_id = ? AND read_at IS NULL`
    )
    .get(personId) as { n: number };
  return row.n;
}

/**
 * Marks notifications as read for a recipient.
 *
 * - No `ids` supplied → marks ALL unread for that recipient.
 * - `ids` supplied    → marks only those ids, still recipient-scoped (can't
 *                       mark another person's notifications).
 */
export function markRead(db: Database.Database, personId: number, ids?: number[]): void {
  if (!ids || ids.length === 0) {
    db.prepare(
      `UPDATE notifications
       SET read_at = datetime('now')
       WHERE recipient_person_id = ? AND read_at IS NULL`
    ).run(personId);
    return;
  }

  // Build a parameterised IN clause; scope to personId for safety.
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `UPDATE notifications
     SET read_at = datetime('now')
     WHERE recipient_person_id = ? AND id IN (${placeholders}) AND read_at IS NULL`
  ).run(personId, ...ids);
}
