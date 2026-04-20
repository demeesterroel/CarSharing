import { z } from "zod";
import { getDb } from "@/lib/db";
import { getFuelFillupById, updateFuelFillup, deleteFuelFillup } from "@/lib/queries/fuel-fillups";
import { json, readBody, readId, notFound } from "@/lib/api";

const FuelFillupSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  liters: z.number().positive(),
  odometer: z.number().int().nonnegative().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getFuelFillupById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, FuelFillupSchema);
  updateFuelFillup(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteFuelFillup(getDb(), id);
  return { ok: true };
});
