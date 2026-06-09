import { json, readBody, requireAdminOrOwner, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCars, insertCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { NextResponse } from "next/server";

export const GET = json(async (req) => {
  await requireSession(req);
  return getCars(getDb());
});

export const POST = json(async (req) => {
  const session = await requireAdminOrOwner(req);
  const data = await readBody(req, carSchema);
  if (!session.isAdmin && session.personId) {
    data.owner_person_id = session.personId;
  }
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
