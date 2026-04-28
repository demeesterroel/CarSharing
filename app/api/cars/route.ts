import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCars, insertCar } from "@/lib/queries/cars";
import { json, readBody } from "@/lib/api";
import { carSchema } from "@/lib/schemas/car";

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, carSchema);
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
