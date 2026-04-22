import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
} from "@/lib/queries/reservations";
import { json, readBody, readId, notFound } from "@/lib/api";

const ReservationSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
  note: z.string().nullable().optional().transform((v) => v ?? null),
  status: z.enum(["pending","confirmed","rejected"]).optional(),
}).refine((v) => v.end_date >= v.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getReservationById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, ReservationSchema);
  updateReservation(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteReservation(getDb(), id);
  return { ok: true };
});
