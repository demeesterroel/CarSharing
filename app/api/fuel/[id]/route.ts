import { json, notFound, readBody, readId, requireCanEdit } from "@/lib/api";
import { getOneHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import {
  ConflictError,
  deleteFuelFillup,
  getFuelFillupById,
  updateFuelFillup,
} from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { NextResponse } from "next/server";

export const GET = getOneHandler(getFuelFillupById);

export const PUT = json(async (req: Request, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const existing = getFuelFillupById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  const data = await readBody(req, fuelFillupSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  try {
    updateFuelFillup(db, id, data, { expectedUpdatedAt });
    notifyAdminOfChange({
      db,
      actor: session,
      action: "updated",
      entity: "fuel fill-up",
      details: [
        `Fill-up ID: ${id}`,
        `Date: ${data.date}`,
        `Car ID: ${data.car_id}`,
        `Amount: €${data.amount}`,
        `Liters: ${data.liters} L`,
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
  const existing = getFuelFillupById(db, id);
  if (!existing) notFound();
  const session = await requireCanEdit(req, existing, db);
  deleteFuelFillup(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "deleted",
    entity: "fuel fill-up",
    details: [
      `Fill-up ID: ${id}`,
      `Date: ${existing.date}`,
      `Car ID: ${existing.car_id}`,
      `Amount: €${existing.amount}`,
      `Liters: ${existing.liters} L`,
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json({ deleted: true });
});
