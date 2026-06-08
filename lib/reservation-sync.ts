// lib/reservation-sync.ts
import type Database from "better-sqlite3";
import { getSetting } from "@/lib/queries/settings";
import * as cal from "@/lib/google-calendar";
import { logSync } from "@/lib/calendar-sync-log";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface ReservationRow {
  id: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  status: string;
  car_short: string;
  person_name: string | null;
  owner_email: string | null;
  google_event_id: string | null;
}

function getCalendarCtx(
  db: Database.Database
): { client: cal.OAuth2Client; calendarId: string } | null {
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return null;
  return { client: cal.getOAuthClient(refreshToken), calendarId };
}

function getReservationForSync(db: Database.Database, id: number): ReservationRow | undefined {
  return db
    .prepare(
      `SELECT r.id, r.start_date, r.end_date, r.start_time, r.end_time, r.note, r.status, r.google_event_id,
              c.short AS car_short,
              TRIM(rq.first_name || ' ' || rq.last_name) AS person_name,
              own.email AS owner_email
       FROM reservations r
       JOIN cars c ON c.id = r.car_id
       JOIN people rq ON rq.id = r.person_id
       LEFT JOIN people own ON own.id = c.owner_person_id
       WHERE r.id = ?`
    )
    .get(id) as ReservationRow | undefined;
}

export async function syncReservationCreate(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r) return;
  const nonce = crypto.randomUUID();
  try {
    const { id: eventId, etag } = await cal.createEvent(
      ctx.client,
      ctx.calendarId,
      r,
      nonce,
      r.owner_email ?? undefined
    );
    db.prepare(
      "UPDATE reservations SET google_event_id=?, last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
    ).run(eventId, etag, nonce, id);
    logSync(db, {
      direction: "outbound",
      action: "create",
      reservationId: id,
      googleEventId: eventId,
      detail: { start: r.start_date, end: r.end_date, status: r.status, ownerEmail: r.owner_email, nonce },
    });
  } catch (e) {
    console.error("[calendar-sync] createEvent failed", e);
    logSync(db, {
      direction: "outbound",
      action: "create",
      reservationId: id,
      ok: false,
      detail: { message: errMessage(e) },
    });
  }
}

export async function syncReservationUpdate(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r || !r.google_event_id) return;
  const nonce = crypto.randomUUID();
  try {
    const { etag } = await cal.updateEvent(
      ctx.client,
      ctx.calendarId,
      r.google_event_id,
      r,
      nonce,
      r.owner_email ?? undefined
    );
    db.prepare("UPDATE reservations SET last_synced_etag=?, last_app_write_nonce=? WHERE id=?").run(
      etag,
      nonce,
      id
    );
    logSync(db, {
      direction: "outbound",
      action: "update",
      reservationId: id,
      googleEventId: r.google_event_id,
      detail: { start: r.start_date, end: r.end_date, status: r.status, nonce },
    });
  } catch (e) {
    console.error("[calendar-sync] updateEvent failed", e);
    logSync(db, {
      direction: "outbound",
      action: "update",
      reservationId: id,
      googleEventId: r.google_event_id,
      ok: false,
      detail: { message: errMessage(e) },
    });
  }
}

export async function syncReservationDelete(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r || !r.google_event_id) return;
  try {
    await cal.deleteEvent(ctx.client, ctx.calendarId, r.google_event_id);
    db.prepare(
      "UPDATE reservations SET google_event_id=NULL, last_synced_etag=NULL, last_app_write_nonce=NULL, last_known_response_status=NULL WHERE id=?"
    ).run(id);
    logSync(db, {
      direction: "outbound",
      action: "delete",
      reservationId: id,
      googleEventId: r.google_event_id,
    });
  } catch (e) {
    console.error("[calendar-sync] deleteEvent failed", e);
    logSync(db, {
      direction: "outbound",
      action: "delete",
      reservationId: id,
      googleEventId: r.google_event_id,
      ok: false,
      detail: { message: errMessage(e) },
    });
  }
}
