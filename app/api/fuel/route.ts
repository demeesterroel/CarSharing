import { NextResponse } from "next/server";
import { getFuelFillups, getFuelFillupById, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { listHandler } from "@/lib/api/crud-handler";
import { json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = listHandler(getFuelFillups);

export const POST = json(async (req: Request) => {
  const raw = await req.json();
  const data = fuelFillupSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertFuelFillup(db, { ...data, client_id });
  return NextResponse.json(getFuelFillupById(db, id), { status: 201 });
});
