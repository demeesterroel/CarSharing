import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getFuelFillups, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { json, readBody } from "@/lib/api";

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

export const GET = json(async () => getFuelFillups(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, FuelFillupSchema);
  const id = insertFuelFillup(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
