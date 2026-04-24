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
  full_tank: z.number().int().min(0).max(1).optional().default(0).transform((v) => v as 0 | 1),
  odometer: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
  receipt: z.string().nullable().optional().transform((v) => v ?? null),
  location: z.string().nullable().optional().transform((v) => v ?? null),
  gps_coords: z.string().nullable().optional().transform((v) => v ?? null),
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
