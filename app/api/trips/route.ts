import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getTrips, insertTrip } from "@/lib/queries/trips";
import { json, readBody } from "@/lib/api";

const TripSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_odometer: z.number().int().nonnegative(),
  end_odometer: z.number().int().nonnegative(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getTrips(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, TripSchema);
  const id = insertTrip(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
