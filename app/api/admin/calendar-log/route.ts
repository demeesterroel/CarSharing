import { json, requireAdmin } from "@/lib/api";
import { getRecentSyncLog } from "@/lib/calendar-sync-log";
import { getDb } from "@/lib/db";

// Read-only view of the calendar sync log (#338). Admin-only — the detail blobs
// can contain owner email addresses and reservation context.
export const GET = json(async (req) => {
  await requireAdmin(req);
  return getRecentSyncLog(getDb(), 200);
});
