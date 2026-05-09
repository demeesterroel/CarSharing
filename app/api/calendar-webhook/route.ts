// app/api/calendar-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/queries/settings";
import { getOAuthClient, listEventsDelta } from "@/lib/google-calendar";
import { processCalendarDelta } from "@/lib/process-calendar-delta";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Initial handshake from Google
  const resourceState = req.headers.get("x-goog-resource-state");
  if (resourceState === "sync") return NextResponse.json({ ok: true });

  const db = getDb();
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return NextResponse.json({ ok: true });

  const client = getOAuthClient(refreshToken);
  const stateRow = db.prepare("SELECT sync_token FROM calendar_sync_state WHERE id = 1").get() as
    | { sync_token: string }
    | undefined;

  let items: Awaited<ReturnType<typeof listEventsDelta>>["items"];
  let nextSyncToken: string;

  try {
    ({ items, nextSyncToken } = await listEventsDelta(
      client,
      calendarId,
      stateRow?.sync_token || undefined
    ));
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 410) {
      // syncToken invalidated — full re-sync
      ({ items, nextSyncToken } = await listEventsDelta(client, calendarId));
    } else {
      console.error("[calendar-webhook] listEventsDelta failed", e);
      return NextResponse.json({ ok: true });
    }
  }

  // Upsert sync_token (INSERT sets defaults for other columns if row doesn't exist yet)
  db.prepare(
    `INSERT INTO calendar_sync_state (id, sync_token) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET sync_token = excluded.sync_token`
  ).run(nextSyncToken);

  await processCalendarDelta(db, client, calendarId, items);

  return NextResponse.json({ ok: true });
}
