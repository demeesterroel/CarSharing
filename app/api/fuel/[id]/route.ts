import { getDb } from "@/lib/db";
import { getFuelFillupById, updateFuelFillup, deleteFuelFillup } from "@/lib/queries/fuel-fillups";
import { json, readBody, readId, notFound } from "@/lib/api";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getFuelFillupById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, fuelFillupSchema);
  updateFuelFillup(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteFuelFillup(getDb(), id);
  return { ok: true };
});
