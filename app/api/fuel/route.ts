import { json, requireSession } from "@/lib/api";
import { listHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import { getFuelFillupById, getFuelFillups, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { fuelFillupSchema } from "@/lib/schemas/fuel-fillup";
import { NextResponse } from "next/server";

export const GET = listHandler(getFuelFillups);

export const POST = json(async (req: Request) => {
  const session = await requireSession(req);
  const raw = await req.json();
  const data = fuelFillupSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertFuelFillup(db, { ...data, client_id });
  const fillup = getFuelFillupById(db, id);
  notifyAdminOfChange({
    db,
    actor: session,
    action: "created",
    entity: "fuel fill-up",
    details: [
      `Date: ${data.date}`,
      `Car ID: ${data.car_id}`,
      `Amount: €${data.amount}`,
      `Liters: ${data.liters} L`,
      ...(data.location ? [`Location: ${data.location}`] : []),
    ].join("\n"),
  }).catch(() => {});
  return NextResponse.json(fillup, { status: 201 });
});
