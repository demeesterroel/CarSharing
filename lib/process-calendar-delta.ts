// lib/process-calendar-delta.ts
import type Database from "better-sqlite3";
import type { OAuth2Client } from "google-auth-library";
import { addDays, updateEvent } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/lib/google-calendar";

interface ReservationRowForDelta {
  id: number;
  start_date: string;
  end_date: string;
  note: string | null;
  status: string;
  car_short: string;
  person_name: string | null;
  last_synced_etag: string | null;
  last_app_write_nonce: string | null;
  last_known_response_status: string | null;
  owner_email: string | null;
}

export async function processCalendarDelta(
  db: Database.Database,
  client: OAuth2Client,
  calendarId: string,
  items: CalendarEvent[]
): Promise<void> {
  for (const event of items) {
    if (!event.id) continue;

    const row = db
      .prepare(
        `SELECT r.id, r.start_date, r.end_date, r.note, r.status, r.last_synced_etag,
                r.last_app_write_nonce, r.last_known_response_status,
                c.short AS car_short,
                TRIM(rq.first_name || ' ' || rq.last_name) AS person_name,
                own.email AS owner_email
         FROM reservations r
         JOIN cars c ON c.id = r.car_id
         JOIN people rq ON rq.id = r.person_id
         LEFT JOIN people own ON own.id = c.owner_person_id
         WHERE r.google_event_id = ?`
      )
      .get(event.id) as ReservationRowForDelta | undefined;

    if (!row) continue;

    // Echo check — skip writes originating from the app itself.
    // Etag is the primary guard. Nonce is a fallback for the rare case where Google
    // returns a delta without an etag — using nonce as primary would suppress external
    // RSVP changes because Google preserves extendedProperties through user edits.
    if (event.etag != null && event.etag === row.last_synced_etag) continue;
    if (
      event.etag == null &&
      event.extendedProperties?.private?.appWriteNonce != null &&
      event.extendedProperties.private.appWriteNonce === row.last_app_write_nonce
    )
      continue;

    // Time-edit guard — app is authoritative for event times
    // Skip time check for cancelled events (start/end may be absent)
    const expectedEnd = addDays(row.end_date, 1);
    if (
      event.status !== "cancelled" &&
      (event.start?.date !== row.start_date || event.end?.date !== expectedEnd)
    ) {
      const nonce = crypto.randomUUID();
      try {
        const { etag } = await updateEvent(
          client,
          calendarId,
          event.id,
          {
            start_date: row.start_date,
            end_date: row.end_date,
            note: row.note,
            status: row.status,
            car_short: row.car_short,
            person_name: row.person_name,
          },
          nonce,
          row.owner_email ?? undefined
        );
        db.prepare(
          "UPDATE reservations SET last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
        ).run(etag, nonce, row.id);
      } catch (e) {
        console.error("[calendar-delta] overwrite time edit failed", e);
      }
      continue;
    }

    // RSVP check
    let newResponseStatus: string;
    if (event.status === "cancelled") {
      newResponseStatus = "declined";
    } else {
      const ownerEmail = row.owner_email;
      const attendee = ownerEmail
        ? event.attendees?.find((a) => a.email === ownerEmail)
        : undefined;
      newResponseStatus = attendee?.responseStatus ?? "needsAction";
    }

    if (newResponseStatus !== row.last_known_response_status) {
      let newStatus: string | null = null;
      if (newResponseStatus === "accepted") newStatus = "confirmed";
      else if (newResponseStatus === "declined") newStatus = "rejected";

      db.prepare(
        "UPDATE reservations SET status=COALESCE(?, status), last_known_response_status=?, last_synced_etag=? WHERE id=?"
      ).run(newStatus, newResponseStatus, event.etag ?? null, row.id);
    }
  }
}
