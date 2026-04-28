import { getDb } from "@/lib/db";
import { updateReservationStatus } from "@/lib/queries/reservations";
import { json, readBody, readId } from "@/lib/api";
import { reservationStatusSchema } from "@/lib/schemas/reservation";

export const PATCH = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, reservationStatusSchema);
  updateReservationStatus(getDb(), id, body.status);
  return { ok: true };
});
