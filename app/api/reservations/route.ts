import { json, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import { notifyUsersOfEvent } from "@/lib/notify-users";
import { getReservationById, getReservations, insertReservation } from "@/lib/queries/reservations";
import { syncReservationCreate } from "@/lib/reservation-sync";
import { reservationSchema } from "@/lib/schemas/reservation";
import { NextResponse } from "next/server";

export const GET = json(async (req) => {
  await requireSession(req);
  return getReservations(getDb());
});

export const POST = json(async (req) => {
  const session = await requireSession(req);
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertReservation(db, { ...body, client_id });
  syncReservationCreate(db, id).catch(() => {});
  const reservation = getReservationById(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "created",
    entity: "reservation",
    details: [
      `Car ID: ${body.car_id}`,
      `From: ${body.start_date}${body.start_time ? ` ${body.start_time}` : ""}`,
      `To: ${body.end_date}${body.end_time ? ` ${body.end_time}` : ""}`,
      ...(body.note ? [`Note: ${body.note}`] : []),
    ].join("\n"),
  }).catch(() => {});
  notifyUsersOfEvent({
    db,
    trigger: "new_reservation",
    entityType: "reservation",
    entityId: id,
    carId: body.car_id,
    actorPersonId: session.personId!,
    message: t("notif.new_reservation", {
      car: reservation?.car_short ?? String(body.car_id),
      start: body.start_date,
      end: body.end_date,
    }),
  }).catch(() => {});
  return NextResponse.json(reservation, { status: 201 });
});
