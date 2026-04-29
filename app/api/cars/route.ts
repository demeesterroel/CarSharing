import { NextResponse } from "next/server";
import { getCars, insertCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import { json, readBody, requireAdmin } from "@/lib/api";

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  await requireAdmin(req);
  const data = await readBody(req, carSchema);
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
