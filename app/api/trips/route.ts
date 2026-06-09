import { json, requireSession } from "@/lib/api";
import { listHandler } from "@/lib/api/crud-handler";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { notifyAdminOfChange } from "@/lib/notify-admin";
import { notifyUsersOfEvent } from "@/lib/notify-users";
import { getTripById, getTrips, insertTrip } from "@/lib/queries/trips";
import { tripSchema } from "@/lib/schemas/trip";
import { NextResponse } from "next/server";

export const GET = listHandler(getTrips);

export const POST = json(async (req: Request) => {
  const session = await requireSession(req);
  const raw = await req.json();
  const data = tripSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertTrip(db, { ...data, client_id });
  const trip = getTripById(db, id);
  if (!session.isAdmin) {
    notifyAdminOfChange({
      db,
      actor: session,
      action: "created",
      entity: "trip",
      details: [
        `Date: ${trip?.date ?? data.date}`,
        `Car: ${trip?.car_short ?? data.car_id}`,
        `Distance: ${data.end_odometer - data.start_odometer} km`,
        `Amount: €${trip?.amount ?? ""}`,
        ...(data.location ? [`Location: ${data.location}`] : []),
      ].join("\n"),
    }).catch(() => {});
  }
  notifyUsersOfEvent({
    db,
    trigger: "new_trip",
    entityType: "trip",
    entityId: id,
    carId: data.car_id,
    actorPersonId: session.personId!,
    message: t("notif.new_trip", {
      car: trip?.car_short ?? String(data.car_id),
      date: trip?.date ?? data.date,
    }),
  }).catch(() => {});
  return NextResponse.json(trip, { status: 201 });
});
