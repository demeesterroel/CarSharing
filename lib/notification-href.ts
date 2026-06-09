import type { Notification } from "@/types";

/**
 * Returns the in-app deep-link URL for a notification.
 * - reservation → /calendar?reservation=<id>
 * - trip        → /trips?trip=<id>
 * - anything else → "" (no link)
 */
export function notificationHref(n: Pick<Notification, "entity_type" | "entity_id">): string {
  if (n.entity_type === "reservation") {
    return `/calendar?reservation=${n.entity_id}`;
  }
  if (n.entity_type === "trip") {
    return `/trips?trip=${n.entity_id}`;
  }
  return "";
}
