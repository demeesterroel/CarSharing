import { getDb } from "@/lib/db";
import { updateReservationStatus } from "@/lib/queries/reservations";
import { json, readBody, readId } from "@/lib/api";
import { reservationStatusSchema } from "@/lib/schemas/reservation";
import { syncReservationUpdate } from "@/lib/reservation-sync";

export const PATCH = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, reservationStatusSchema);
  const db = getDb();
  updateReservationStatus(db, id, body.status);
  syncReservationUpdate(db, id).catch(() => {});
  return { ok: true };
});
