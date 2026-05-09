// lib/google-calendar.ts
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type { OAuth2Client };

export interface CalendarEvent {
  id?: string | null;
  etag?: string | null;
  status?: string | null;
  start?: { date?: string | null };
  end?: { date?: string | null };
  attendees?: Array<{ email?: string | null; responseStatus?: string | null }>;
  extendedProperties?: { private?: { appWriteNonce?: string | null } };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getOAuthClient(refreshToken: string): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

interface ReservationShape {
  start_date: string;
  end_date: string;
  note?: string | null;
  status?: string;
  car_short?: string | null;
  person_name?: string | null;
}

function buildEventBody(r: ReservationShape, nonce: string, ownerEmail?: string): object {
  const calStatus =
    r.status === "confirmed" ? "confirmed" : r.status === "rejected" ? "cancelled" : "tentative";
  return {
    summary: r.car_short ? `[${r.car_short}] ${r.person_name ?? ""}` : "Reservering",
    description: r.note ?? undefined,
    start: { date: r.start_date },
    end: { date: addDays(r.end_date, 1) },
    status: calStatus,
    attendees: ownerEmail ? [{ email: ownerEmail }] : undefined,
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
    expiration: new Date(Number(res.data.expiration)).toISOString(),
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
  const res = await cal.events.list({ calendarId, syncToken, showDeleted: true });
  return {
    items: (res.data.items ?? []) as CalendarEvent[],
    nextSyncToken: res.data.nextSyncToken!,
  };
}
