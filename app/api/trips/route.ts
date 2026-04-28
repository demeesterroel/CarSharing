import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTrips, insertTrip } from "@/lib/queries/trips";
import { json, readBody } from "@/lib/api";
import { tripSchema } from "@/lib/schemas/trip";

export const GET = json(async () => getTrips(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, tripSchema);
  const id = insertTrip(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
