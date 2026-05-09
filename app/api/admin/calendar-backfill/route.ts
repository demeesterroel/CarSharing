import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { json, requireAdmin } from "@/lib/api";
import { getSetting } from "@/lib/queries/settings";
import { env } from "@/lib/env";
import { syncReservationCreate } from "@/lib/reservation-sync";

export const POST = json(async (req) => {
  await requireAdmin(req);
  const db = getDb();

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return NextResponse.json({ ok: false, error: "no_env_credentials" });

  if (!getSetting(db, "google_calendar_id"))
    return NextResponse.json({ ok: false, error: "no_calendar_id" });

  if (!getSetting(db, "google_oauth_refresh_token"))
    return NextResponse.json({ ok: false, error: "no_token" });

  const today = new Date().toISOString().slice(0, 10);

  // Upcoming reservations not yet synced
  const rows = db
    .prepare(
      `SELECT id FROM reservations
       WHERE end_date >= ? AND google_event_id IS NULL AND status != 'rejected'
       ORDER BY start_date`
    )
    .all(today) as { id: number }[];

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await syncReservationCreate(db, row.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, synced, failed, total: rows.length });
});
