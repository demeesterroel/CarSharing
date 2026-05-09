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
  const stateRow = db
    .prepare("SELECT sync_token, channel_id FROM calendar_sync_state WHERE id = 1")
    .get() as { sync_token: string; channel_id: string } | undefined;

  // Validate channel ID to reject spoofed webhook calls
  const incomingChannelId = req.headers.get("x-goog-channel-id");
  if (stateRow && incomingChannelId !== stateRow.channel_id) {
    return NextResponse.json({ ok: true });
  }

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
      try {
        ({ items, nextSyncToken } = await listEventsDelta(client, calendarId));
      } catch (e2) {
        console.error("[calendar-webhook] full re-sync also failed", e2);
        return NextResponse.json({ ok: true });
      }
    } else {
      console.error("[calendar-webhook] listEventsDelta failed", e);
      return NextResponse.json({ ok: true });
    }
  }

  await processCalendarDelta(db, client, calendarId, items);

  // Upsert sync_token after processing so a crash mid-processing triggers a retry
  db.prepare(
    `INSERT INTO calendar_sync_state (id, sync_token) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET sync_token = excluded.sync_token`
  ).run(nextSyncToken);

  return NextResponse.json({ ok: true });
}
