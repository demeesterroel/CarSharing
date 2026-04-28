import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getFuelFillups, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { json, readBody } from "@/lib/api";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";

export const GET = json(async () => getFuelFillups(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, fuelFillupSchema);
  const id = insertFuelFillup(getDb(), body);
  return NextResponse.json({ id }, { status: 201 });
});
