import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
  ConflictError,
} from "@/lib/queries/reservations";
import { json, readBody, readId, notFound } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationUpdate, syncReservationDelete } from "@/lib/reservation-sync";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getReservationById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, reservationSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  const db = getDb();
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

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  await syncReservationDelete(db, id).catch(() => {});
  deleteReservation(db, id);
  return NextResponse.json({ deleted: true });
});
