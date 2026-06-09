import { json, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listNotifications } from "@/lib/queries/notifications";

export const GET = json(async (req) => {
  const session = await requireSession(req);
  return listNotifications(getDb(), session.personId!);
});
