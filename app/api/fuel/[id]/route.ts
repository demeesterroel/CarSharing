import { NextResponse } from "next/server";
import {
  getFuelFillupById,
  updateFuelFillup,
  deleteFuelFillup,
  ConflictError,
} from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { getOneHandler } from "@/lib/api/crud-handler";
import { json, readBody, readId } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = getOneHandler(getFuelFillupById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, fuelFillupSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateFuelFillup(getDb(), id, data, { expectedUpdatedAt });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
});

export const DELETE = json(async (_req: Request, ctx) => {
  const id = await readId(ctx);
  const result = getDb().prepare("DELETE FROM fuel_fillups WHERE id = ?").run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
});
