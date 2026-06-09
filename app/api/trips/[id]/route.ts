import { json, notFound, readBody, readId, requireCanEdit } from "@/lib/api";
import { getOneHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import { ConflictError, deleteTrip, getTripById, updateTrip } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { NextResponse } from "next/server";

export const GET = getOneHandler(getTripById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getTripById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  const data = await readBody(req, tripSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateTrip(db, id, data, { expectedUpdatedAt });
    notifyAdminOfChange({
      db,
      actor: session,
      action: "updated",
      entity: "trip",
      details: [
        `Trip ID: ${id}`,
        `Date: ${data.date}`,
        `Car ID: ${data.car_id}`,
        `Distance: ${data.end_odometer - data.start_odometer} km`,
        ...(data.location ? [`Location: ${data.location}`] : []),
      ].join("\n"),
    }).catch(() => {});
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
  const existing = getTripById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  deleteTrip(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "deleted",
    entity: "trip",
    details: [
      `Trip ID: ${id}`,
      `Date: ${existing.date}`,
      `Car ID: ${existing.car_id}`,
      `Distance: ${existing.km} km`,
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json({ deleted: true });
});
