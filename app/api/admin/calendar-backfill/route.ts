import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { json, requireAdmin } from "@/lib/api";
import { getSetting } from "@/lib/queries/settings";
import { env } from "@/lib/env";
import { syncReservationCreate, syncReservationUpdate } from "@/lib/reservation-sync";

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

  // Reconcile every upcoming non-rejected reservation: create a calendar event
  // for ones not yet synced, and re-push the desired state for ones that already
  // have an event (repaints title/color/attendees/status, e.g. the ✓+green
  // confirmed marker, and repairs any drift). Updates are nonce-stamped, so the
  // resulting webhook is skipped by the echo guard — no loop.
  const rows = db
    .prepare(
      `SELECT id, google_event_id FROM reservations
       WHERE end_date >= ? AND status != 'rejected'
       ORDER BY start_date`
    )
    .all(today) as { id: number; google_event_id: string | null }[];

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (row.google_event_id) {
        await syncReservationUpdate(db, row.id);
        updated++;
      } else {
        await syncReservationCreate(db, row.id);
        created++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    synced: created + updated,
    created,
    updated,
    failed,
    total: rows.length,
  });
});
