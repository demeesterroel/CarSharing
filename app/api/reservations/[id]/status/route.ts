import { z } from "zod";
import { getDb } from "@/lib/db";
import { updateReservationStatus } from "@/lib/queries/reservations";
import { json, readBody, readId } from "@/lib/api";

const StatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected"]),
});

export const PATCH = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, StatusSchema);
  updateReservationStatus(getDb(), id, body.status);
  return { ok: true };
});
