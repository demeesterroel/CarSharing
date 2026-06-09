import { json, notFound, readBody, readId, requireAdminOrCarOwner } from "@/lib/api";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { notifyUsersOfEvent } from "@/lib/notify-users";
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
  const session = await requireAdminOrCarOwner(req, reservation.car_id, db);
  const body = await readBody(req, reservationStatusSchema);
  updateReservationStatus(db, id, body.status);
  syncReservationUpdate(db, id).catch(() => {});
  const statusWordKey =
    body.status === "confirmed"
      ? "notif.status_confirmed"
      : body.status === "rejected"
        ? "notif.status_rejected"
        : "notif.status_pending";
  notifyUsersOfEvent({
    db,
    trigger: "reservation_update",
    entityType: "reservation",
    entityId: id,
    carId: reservation.car_id,
    actorPersonId: session.personId!,
    alwaysNotifyPersonId: reservation.person_id,
    message: t("notif.reservation_update", {
      car: reservation.car_short ?? String(reservation.car_id),
      start: reservation.start_date,
      end: reservation.end_date,
      status: t(statusWordKey),
    }),
  }).catch(() => {});
  return { ok: true };
});
