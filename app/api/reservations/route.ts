import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody, badRequest } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, reservationSchema);
  const id = insertReservation(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
