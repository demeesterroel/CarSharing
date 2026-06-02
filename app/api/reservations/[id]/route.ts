import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
  ConflictError,
} from "@/lib/queries/reservations";
import { json, readBody, readId, notFound, requireCanEdit, requireSession } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationUpdate, syncReservationDelete } from "@/lib/reservation-sync";

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
  await requireCanEdit(req, existing, db);
  const body = await readBody(req, reservationSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateReservation(db, id, body, { expectedUpdatedAt });
    syncReservationUpdate(db, id).catch(() => {});
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
  await requireCanEdit(req, existing, db);
  await syncReservationDelete(db, id).catch(() => {});
  deleteReservation(db, id);
  return NextResponse.json({ deleted: true });
});
