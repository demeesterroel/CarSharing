import { z } from "zod";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCars, insertCar } from "@/lib/queries/cars";
import { json, readBody } from "@/lib/api";

const CarSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z.string().nullable().optional().transform((v) => v ?? null),
  color: z.string().nullable().optional().transform((v) => v ?? null),
  owner_name: z.string().nullable().optional().transform((v) => v ?? null),
  long_threshold: z.number().int().positive().optional().default(500),
  fixed_costs_json: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, CarSchema);
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
