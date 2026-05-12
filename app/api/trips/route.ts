import { NextResponse } from "next/server";
import { getTrips, getTripById, insertTrip } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { listHandler } from "@/lib/api/crud-handler";
import { json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = listHandler(getTrips);

export const POST = json(async (req: Request) => {
  const raw = await req.json();
  const data = tripSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertTrip(db, { ...data, client_id });
  return NextResponse.json(getTripById(db, id), { status: 201 });
});
