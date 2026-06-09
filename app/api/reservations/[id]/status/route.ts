import { json, notFound, readBody, readId, requireAdminOrCarOwner } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getReservationById, updateReservationStatus } from "@/lib/queries/reservations";
import { syncReservationUpdate } from "@/lib/reservation-sync";
import { reservationStatusSchema } from "@/lib/schemas/reservation";

export const PATCH = json(async (req, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  const reservation = getReservationById(db, id);
  if (!reservation) notFound();
  // Confirming/rejecting a reservation is the car owner's (or an admin's)
  // decision — not something every authenticated member may do.
  await requireAdminOrCarOwner(req, reservation.car_id, db);
  const body = await readBody(req, reservationStatusSchema);
  updateReservationStatus(db, id, body.status);
  syncReservationUpdate(db, id).catch(() => {});
  return { ok: true };
});
