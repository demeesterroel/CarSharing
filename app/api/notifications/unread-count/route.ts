import { json, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { unreadCount } from "@/lib/queries/notifications";

export const GET = json(async (req) => {
  const session = await requireSession(req);
  return { count: unreadCount(getDb(), session.personId!) };
});
