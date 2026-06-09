import { json, notFound, readBody, readId, requireCanEdit, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import {
  ConflictError,
  deleteReservation,
  getReservationById,
  updateReservation,
} from "@/lib/queries/reservations";
import { syncReservationDelete, syncReservationUpdate } from "@/lib/reservation-sync";
import { reservationSchema } from "@/lib/schemas/reservation";
import { NextResponse } from "next/server";

export const GET = json(async (req, ctx) => {
  await requireSession(req);
  const id = await readId(ctx);
  const row = getReservationById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getReservationById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  const body = await readBody(req, reservationSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateReservation(db, id, body, { expectedUpdatedAt });
    syncReservationUpdate(db, id).catch(() => {});
    notifyAdminOfChange({
      db,
      actor: session,
      action: "updated",
      entity: "reservation",
      details: [
        `Reservation ID: ${id}`,
        `Car ID: ${body.car_id}`,
        `From: ${body.start_date}${body.start_time ? ` ${body.start_time}` : ""}`,
        `To: ${body.end_date}${body.end_time ? ` ${body.end_time}` : ""}`,
        ...(body.note ? [`Note: ${body.note}`] : []),
      ].join("\n"),
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
});

export const DELETE = json(async (req, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getReservationById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  await syncReservationDelete(db, id).catch(() => {});
  deleteReservation(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "deleted",
    entity: "reservation",
    details: [
      `Reservation ID: ${id}`,
      `Car ID: ${existing.car_id}`,
      `From: ${existing.start_date}${existing.start_time ? ` ${existing.start_time}` : ""}`,
      `To: ${existing.end_date}${existing.end_time ? ` ${existing.end_time}` : ""}`,
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json({ deleted: true });
});
