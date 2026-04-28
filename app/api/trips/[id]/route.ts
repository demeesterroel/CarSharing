import { getDb } from "@/lib/db";
import { getTripById, updateTrip, deleteTrip } from "@/lib/queries/trips";
import { json, readBody, readId, notFound } from "@/lib/api";
import { tripSchema } from "@/lib/schemas/trip";

export const GET = json(async (_req, ctx) => {
  const trip = getTripById(getDb(), await readId(ctx));
  if (!trip) notFound();
  return trip;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, tripSchema);
  updateTrip(getDb(), id, data);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  deleteTrip(getDb(), await readId(ctx));
  return { ok: true };
});
