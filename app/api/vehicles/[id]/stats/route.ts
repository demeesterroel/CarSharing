import { json, readId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarStats, getLastYearWithStats } from "@/lib/queries/cars";

export const GET = json(async (_req, ctx) => {
  const carId = await readId(ctx);
  const db = getDb();
  const year = getLastYearWithStats(db, carId) ?? new Date().getFullYear();
  return { year, ...getCarStats(db, carId, year) };
});
