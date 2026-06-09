import { json, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getReservationById, getReservations, insertReservation } from "@/lib/queries/reservations";
import { syncReservationCreate } from "@/lib/reservation-sync";
import { reservationSchema } from "@/lib/schemas/reservation";
import { NextResponse } from "next/server";

export const GET = json(async (req) => {
  await requireSession(req);
  return getReservations(getDb());
});

export const POST = json(async (req) => {
  await requireSession(req);
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertReservation(db, { ...body, client_id });
  syncReservationCreate(db, id).catch(() => {});
  const reservation = getReservationById(db, id);
  return NextResponse.json(reservation, { status: 201 });
});
