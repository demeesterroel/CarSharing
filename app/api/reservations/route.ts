import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const id = insertReservation(getDb(), { ...body, client_id });
  return NextResponse.json({ id }, { status: 201 });
});
