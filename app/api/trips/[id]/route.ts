import { NextResponse } from "next/server";
import { getTripById, updateTrip, deleteTrip, ConflictError } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { getOneHandler } from "@/lib/api/crud-handler";
import { json, readBody, readId } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = getOneHandler(getTripById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, tripSchema);
  const expectedUpdatedAt = (req as Request).headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateTrip(getDb(), id, data, { expectedUpdatedAt });
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
  const result = getDb().prepare("DELETE FROM trips WHERE id = ?").run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
});
