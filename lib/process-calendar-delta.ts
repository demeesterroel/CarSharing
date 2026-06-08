// lib/process-calendar-delta.ts
import type Database from "better-sqlite3";
import type { OAuth2Client } from "google-auth-library";
import { addDays, updateEvent } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/lib/google-calendar";
import { logSync } from "@/lib/calendar-sync-log";

interface ReservationRowForDelta {
  id: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
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
        `SELECT r.id, r.start_date, r.end_date, r.start_time, r.note, r.status, r.last_synced_etag,
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
    if (event.etag != null && event.etag === row.last_synced_etag) {
      logSync(db, {
        direction: "inbound",
        action: "echo-skip",
        reservationId: row.id,
        googleEventId: event.id,
        detail: { reason: "etag", etag: event.etag },
      });
      continue;
    }
    if (
      event.etag == null &&
      event.extendedProperties?.private?.appWriteNonce != null &&
      event.extendedProperties.private.appWriteNonce === row.last_app_write_nonce
    ) {
      logSync(db, {
        direction: "inbound",
        action: "echo-skip",
        reservationId: row.id,
        googleEventId: event.id,
        detail: { reason: "nonce" },
      });
      continue;
    }

    // Time-edit guard — app is authoritative for all-day event dates.
    // Skip cancelled events (start/end may be absent). Skip TIMED reservations
    // (#191): their times are push-only and not reconciled from GCal, and the
    // all-day date comparison below doesn't apply to dateTime events.
    const expectedEnd = addDays(row.end_date, 1);
    if (
      event.status !== "cancelled" &&
      row.start_time == null &&
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
        logSync(db, {
          direction: "outbound",
          action: "time-overwrite",
          reservationId: row.id,
          googleEventId: event.id,
          detail: {
            eventStart: event.start?.date,
            eventEnd: event.end?.date,
            rowStart: row.start_date,
            rowEnd: expectedEnd,
            nonce,
          },
        });
      } catch (e) {
        console.error("[calendar-delta] overwrite time edit failed", e);
        logSync(db, {
          direction: "outbound",
          action: "time-overwrite",
          reservationId: row.id,
          googleEventId: event.id,
          ok: false,
          detail: { message: e instanceof Error ? e.message : String(e) },
        });
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

    // After an in-app or GCal confirm we remove the owner attendee (below /
    // buildEventBody), so later deltas legitimately report needsAction. Don't let
    // that churn or revert an already-confirmed reservation.
    if (newResponseStatus === "needsAction" && row.status === "confirmed") continue;

    if (newResponseStatus !== row.last_known_response_status) {
      if (newResponseStatus === "accepted") {
        // Owner accepted the invite in Google Calendar. Converge to the same
        // end-state as an in-app confirm: mark the event confirmed AND remove the
        // owner attendee (buildEventBody drops it when status=confirmed). This is
        // an app write — it stamps a fresh nonce/etag, so the webhook it triggers
        // is skipped by the echo guard above. No loop. (#337)
        const nonce = crypto.randomUUID();
        let newEtag: string | null = event.etag ?? null;
        try {
          const res = await updateEvent(
            client,
            calendarId,
            event.id,
            {
              start_date: row.start_date,
              end_date: row.end_date,
              note: row.note,
              status: "confirmed",
              car_short: row.car_short,
              person_name: row.person_name,
            },
            nonce,
            row.owner_email ?? undefined
          );
          newEtag = res.etag;
          logSync(db, {
            direction: "outbound",
            action: "confirm",
            reservationId: row.id,
            googleEventId: event.id,
            detail: { nonce, uninvited: row.owner_email ?? null },
          });
        } catch (e) {
          console.error("[calendar-delta] confirm push failed", e);
          logSync(db, {
            direction: "outbound",
            action: "confirm",
            reservationId: row.id,
            googleEventId: event.id,
            ok: false,
            detail: { message: e instanceof Error ? e.message : String(e) },
          });
        }
        db.prepare(
          "UPDATE reservations SET status='confirmed', last_known_response_status='accepted', last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
        ).run(newEtag, nonce, row.id);
        logSync(db, {
          direction: "inbound",
          action: "rsvp",
          reservationId: row.id,
          googleEventId: event.id,
          detail: {
            from: row.last_known_response_status,
            to: "accepted",
            newStatus: "confirmed",
            eventStatus: event.status,
          },
        });
      } else if (newResponseStatus === "declined") {
        // Owner declined the invite, or removed it from their own calendar. Flip to
        // rejected AND converge the calendar: if the shared event is still live,
        // cancel it so it doesn't linger as a ghost (#350 / #7 / #8bis). If the
        // event is already cancelled (owner deleted the shared event, #8), there is
        // nothing to push. The push is nonce-stamped → echo-skipped, no loop.
        const nonce = crypto.randomUUID();
        let newEtag: string | null = event.etag ?? null;
        if (event.status !== "cancelled") {
          try {
            const res = await updateEvent(
              client,
              calendarId,
              event.id,
              {
                start_date: row.start_date,
                end_date: row.end_date,
                note: row.note,
                status: "rejected",
                car_short: row.car_short,
                person_name: row.person_name,
              },
              nonce,
              row.owner_email ?? undefined
            );
            newEtag = res.etag;
            logSync(db, {
              direction: "outbound",
              action: "cancel",
              reservationId: row.id,
              googleEventId: event.id,
              detail: { nonce, reason: "declined" },
            });
          } catch (e) {
            console.error("[calendar-delta] cancel push failed", e);
            logSync(db, {
              direction: "outbound",
              action: "cancel",
              reservationId: row.id,
              googleEventId: event.id,
              ok: false,
              detail: { message: e instanceof Error ? e.message : String(e) },
            });
          }
        }
        db.prepare(
          "UPDATE reservations SET status='rejected', last_known_response_status='declined', last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
        ).run(newEtag, nonce, row.id);
        logSync(db, {
          direction: "inbound",
          action: "rsvp",
          reservationId: row.id,
          googleEventId: event.id,
          detail: {
            from: row.last_known_response_status,
            to: "declined",
            newStatus: "rejected",
            eventStatus: event.status,
          },
        });
      } else {
        // Other transitions (e.g. needsAction) — record the RSVP, leave status.
        db.prepare(
          "UPDATE reservations SET last_known_response_status=?, last_synced_etag=? WHERE id=?"
        ).run(newResponseStatus, event.etag ?? null, row.id);
        logSync(db, {
          direction: "inbound",
          action: "rsvp",
          reservationId: row.id,
          googleEventId: event.id,
          detail: {
            from: row.last_known_response_status,
            to: newResponseStatus,
            newStatus: null,
            eventStatus: event.status,
          },
        });
      }
    }
  }
}
