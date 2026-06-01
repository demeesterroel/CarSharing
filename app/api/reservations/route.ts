import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, getReservationById, insertReservation } from "@/lib/queries/reservations";
import { json, readBody, requireSession } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationCreate } from "@/lib/reservation-sync";

export const GET = json(async (req) => {
  await requireSession(req);
  return getReservations(getDb());
});

export const POST = json(async (req) => {
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertReservation(db, { ...body, client_id });
  syncReservationCreate(db, id).catch(() => {});
  const reservation = getReservationById(db, id);
  return NextResponse.json(reservation, { status: 201 });
});
