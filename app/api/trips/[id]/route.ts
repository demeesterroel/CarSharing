import { z } from "zod";
import { getDb } from "@/lib/db";
import { getTripById, updateTrip, deleteTrip } from "@/lib/queries/trips";
import { json, readBody, readId, notFound } from "@/lib/api";

const TripSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_odometer: z.number().int().nonnegative(),
  end_odometer: z.number().int().nonnegative(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx) => {
  const trip = getTripById(getDb(), await readId(ctx));
  if (!trip) notFound();
  return trip;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, TripSchema);
  updateTrip(getDb(), id, data);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  deleteTrip(getDb(), await readId(ctx));
  return { ok: true };
});
