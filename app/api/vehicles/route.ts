import { NextResponse } from "next/server";
import { getCars, insertCar } from "@/lib/queries/cars";
import { carSchema } from "@/lib/schemas/car";
import { getDb } from "@/lib/db";
import { json, readBody, requireAdminOrOwner } from "@/lib/api";

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  const session = await requireAdminOrOwner(req);
  const data = await readBody(req, carSchema);
  if (!session.isAdmin && session.personId) {
    data.owner_person_id = session.personId;
  }
  const id = insertCar(getDb(), data);
  return NextResponse.json({ id }, { status: 201 });
});
