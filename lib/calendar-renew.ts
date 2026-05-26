// lib/calendar-renew.ts
import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { getSetting } from "@/lib/queries/settings";
import { getOAuthClient, watchEvents, stopChannel, listEventsDelta } from "@/lib/google-calendar";
import { processCalendarDelta } from "@/lib/process-calendar-delta";

export interface RenewResult {
  ok: boolean;
  skipped?: string;
  renewed?: boolean;
  expiresAt?: string;
}

export async function handleCalendarRenew(
  db: Database.Database,
  baseUrl: string
): Promise<RenewResult> {
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return { ok: true, skipped: "disabled" };

  const client = getOAuthClient(refreshToken);

  const stateRow = db.prepare("SELECT * FROM calendar_sync_state WHERE id = 1").get() as
    | {
        channel_id: string;
        resource_id: string;
        expiration_at: string;
        sync_token: string;
      }
    | undefined;

  if (stateRow) {
    const expiresMs = new Date(stateRow.expiration_at).getTime();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    if (!isNaN(expiresMs) && expiresMs - Date.now() > fiveDaysMs) {
      // Channel healthy — still run a delta sync to recover any missed webhook notifications
      try {
        const { items, nextSyncToken } = await listEventsDelta(
          client,
          calendarId,
          stateRow.sync_token
        );
        await processCalendarDelta(db, client, calendarId, items);
        db.prepare("UPDATE calendar_sync_state SET sync_token=? WHERE id=1").run(nextSyncToken);
      } catch (e: unknown) {
        const code = (e as { code?: number })?.code;
        if (code === 410) {
          const { items, nextSyncToken } = await listEventsDelta(client, calendarId);
          await processCalendarDelta(db, client, calendarId, items);
          db.prepare("UPDATE calendar_sync_state SET sync_token=? WHERE id=1").run(nextSyncToken);
        } else {
          console.error("[calendar-renew] delta sync failed", e);
        }
      }
      return { ok: true, skipped: "not_due" };
    }
    try {
      await stopChannel(client, stateRow.channel_id, stateRow.resource_id);
    } catch (e) {
      console.error("[calendar-renew] stopChannel failed (continuing)", e);
    }
  }

  const channelId = randomUUID();
  const webhookUrl = `${baseUrl}/api/calendar-webhook`;
  const newChannel = await watchEvents(client, calendarId, webhookUrl, channelId);

  // Catch up on missed events before persisting the new channel
  let nextSyncToken = stateRow?.sync_token;
  try {
    const delta = await listEventsDelta(client, calendarId, stateRow?.sync_token);
    nextSyncToken = delta.nextSyncToken;
    await processCalendarDelta(db, client, calendarId, delta.items);
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 410) {
      const delta = await listEventsDelta(client, calendarId);
      nextSyncToken = delta.nextSyncToken;
      await processCalendarDelta(db, client, calendarId, delta.items);
    } else {
      console.error("[calendar-renew] listEventsDelta failed", e);
      throw e;
    }
  }

  db.prepare(
    `INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       channel_id=excluded.channel_id,
       resource_id=excluded.resource_id,
       expiration_at=excluded.expiration_at,
       sync_token=excluded.sync_token`
  ).run(newChannel.channelId, newChannel.resourceId, newChannel.expiration, nextSyncToken ?? "");

  return { ok: true, renewed: true, expiresAt: newChannel.expiration };
}
