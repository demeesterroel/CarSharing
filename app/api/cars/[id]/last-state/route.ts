import { getDb } from "@/lib/db";
import { getLastCarState } from "@/lib/queries/car-state";
import { json, readId } from "@/lib/api";

export const GET = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const carId = await readId(ctx);
  return getLastCarState(getDb(), carId);
});
