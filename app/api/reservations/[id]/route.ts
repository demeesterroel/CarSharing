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
  try {
    updateReservation(getDb(), id, body, { expectedUpdatedAt });
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
  const result = getDb().prepare("DELETE FROM reservations WHERE id = ?").run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
});
