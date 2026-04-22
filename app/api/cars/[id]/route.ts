import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCarById, updateCar } from "@/lib/queries/cars";
import { json, readBody, readId, notFound } from "@/lib/api";

const CarSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z.string().nullable().optional().transform((v) => v ?? null),
  color: z.string().nullable().optional().transform((v) => v ?? null),
  owner_name: z.string().nullable().optional().transform((v) => v ?? null),
  long_threshold: z.number().int().positive().optional().default(500),
  fixed_costs_json: z.string().nullable().optional().transform((v) => v ?? null),
  active: z.number().int().min(0).max(1).optional().default(1),
  expected_km: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx) => {
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, CarSchema);
  updateCar(getDb(), id, data);
  return { ok: true };
});
