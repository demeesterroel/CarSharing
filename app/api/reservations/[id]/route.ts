import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
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
  updateReservation(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteReservation(getDb(), id);
  return { ok: true };
});
