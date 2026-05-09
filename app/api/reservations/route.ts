import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationCreate } from "@/lib/reservation-sync";

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertReservation(db, { ...body, client_id });
  syncReservationCreate(db, id).catch(() => {});
  return NextResponse.json({ id }, { status: 201 });
});
