import { NextResponse } from "next/server";
import {
  getFuelFillupById,
  updateFuelFillup,
  deleteFuelFillup,
  ConflictError,
} from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { getOneHandler } from "@/lib/api/crud-handler";
import { json, readBody, readId, notFound, requireCanEdit } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = getOneHandler(getFuelFillupById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getFuelFillupById(db, id);
  if (!existing) notFound();
  await requireCanEdit(req, existing, db);
  const data = await readBody(req, fuelFillupSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateFuelFillup(db, id, data, { expectedUpdatedAt });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
});

export const DELETE = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getFuelFillupById(db, id);
  if (!existing) notFound();
  await requireCanEdit(req, existing, db);
  deleteFuelFillup(db, id);
  return NextResponse.json({ deleted: true });
});
