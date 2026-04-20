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
  odometer: z.number().int().nonnegative().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getFuelFillups(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, FuelFillupSchema);
  const id = insertFuelFillup(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
