// lib/google-calendar.ts
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { env } from "@/lib/env";

export type { OAuth2Client };

export interface CalendarEvent {
  id?: string | null;
  etag?: string | null;
  status?: string | null;
  start?: { date?: string | null; dateTime?: string | null };
  end?: { date?: string | null; dateTime?: string | null };
  attendees?: Array<{ email?: string | null; responseStatus?: string | null }>;
  extendedProperties?: { private?: { appWriteNonce?: string | null } };
}

// All-day events use floating local dates; timed events are pinned to this zone.
const EVENT_TIME_ZONE = "Europe/Brussels";

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getOAuthClient(refreshToken: string): OAuth2Client {
  const client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

interface ReservationShape {
  start_date: string;
  end_date: string;
  /** HH:MM; when both set the event is timed (single day), else all-day. (#191) */
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
  status?: string;
  car_short?: string | null;
  person_name?: string | null;
}

export function buildEventBody(r: ReservationShape, nonce: string, ownerEmail?: string): object {
  const calStatus =
    r.status === "confirmed" ? "confirmed" : r.status === "rejected" ? "cancelled" : "tentative";
  // While a reservation is pending, the owner is invited as an attendee so they
  // can accept/decline from their own calendar. Once confirmed, the decision is
  // made — drop the owner attendee so the event leaves their personal calendar
  // and stops showing "1 guest, awaiting reply" (#337). An empty array (not
  // undefined) is required for events.update to actually clear an attendee.
  const attendees = ownerEmail && calStatus !== "confirmed" ? [{ email: ownerEmail }] : [];
  const confirmed = calStatus === "confirmed";
  // Google has no checkmark UI for status=confirmed, so confirmed and tentative
  // all-day events look identical. Add an explicit visual cue (#344): a ✓ title
  // prefix and a green colorId (10 = Basil). Pending/rejected keep the default.
  const baseSummary = r.car_short ? `[${r.car_short}] ${r.person_name ?? ""}` : "Reservering";
  // Timed reservation (#191): start_time is on start_date, end_time on end_date
  // (may span multiple days). Otherwise an all-day event (end exclusive, +1 day).
  const timed = !!r.start_time && !!r.end_time;
  const start = timed
    ? { dateTime: `${r.start_date}T${r.start_time}:00`, timeZone: EVENT_TIME_ZONE }
    : { date: r.start_date };
  const end = timed
    ? { dateTime: `${r.end_date}T${r.end_time}:00`, timeZone: EVENT_TIME_ZONE }
    : { date: addDays(r.end_date, 1) };
  return {
    summary: confirmed ? `✓ ${baseSummary}` : baseSummary,
    description: r.note ?? undefined,
    start,
    end,
    status: calStatus,
    colorId: confirmed ? "10" : undefined,
    attendees,
    extendedProperties: { private: { appWriteNonce: nonce } },
  };
}

export async function createEvent(
  client: OAuth2Client,
  calendarId: string,
  r: ReservationShape,
  nonce: string,
  ownerEmail?: string
): Promise<{ id: string; etag: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.insert({
    calendarId,
    requestBody: buildEventBody(r, nonce, ownerEmail),
  });
  return { id: res.data.id!, etag: res.data.etag! };
}

export async function updateEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string,
  r: ReservationShape,
  nonce: string,
  ownerEmail?: string
): Promise<{ etag: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.update({
    calendarId,
    eventId,
    requestBody: buildEventBody(r, nonce, ownerEmail),
  });
  return { etag: res.data.etag! };
}

export async function deleteEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string
): Promise<void> {
  const cal = google.calendar({ version: "v3", auth: client });
  await cal.events.delete({ calendarId, eventId });
}

export async function watchEvents(
  client: OAuth2Client,
  calendarId: string,
  webhookUrl: string,
  channelId: string
): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.watch({
    calendarId,
    requestBody: { id: channelId, type: "web_hook", address: webhookUrl },
  });
  return {
    channelId: res.data.id!,
    resourceId: res.data.resourceId!,
    expiration: res.data.expiration ? new Date(Number(res.data.expiration)).toISOString() : "",
  };
}

export async function stopChannel(
  client: OAuth2Client,
  channelId: string,
  resourceId: string
): Promise<void> {
  const cal = google.calendar({ version: "v3", auth: client });
  await cal.channels.stop({ requestBody: { id: channelId, resourceId } });
}

export async function listEventsDelta(
  client: OAuth2Client,
  calendarId: string,
  syncToken?: string
): Promise<{ items: CalendarEvent[]; nextSyncToken: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const allItems: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const res = await cal.events.list({ calendarId, syncToken, showDeleted: true, pageToken });
    allItems.push(...((res.data.items ?? []) as CalendarEvent[]));
    if (res.data.nextSyncToken) {
      return { items: allItems, nextSyncToken: res.data.nextSyncToken };
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  throw new Error("listEventsDelta: exhausted pages without nextSyncToken");
}
