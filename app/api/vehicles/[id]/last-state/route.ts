import { json, readId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getLastCarState } from "@/lib/queries/car-state";

export const GET = json(async (_req, ctx) => {
  const carId = await readId(ctx);
  return getLastCarState(getDb(), carId);
});
