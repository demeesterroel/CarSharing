import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody, badRequest } from "@/lib/api";

const ReservationSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
}).refine((v) => v.end_date >= v.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, ReservationSchema);
  const id = insertReservation(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
