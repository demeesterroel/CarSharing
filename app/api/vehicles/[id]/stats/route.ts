import { json, readId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarStats, getLatestDataYear } from "@/lib/queries/cars";

// GET /api/vehicles/[id]/stats?year=YYYY — per-car efficiency & usage stats (#374).
// Defaults to the latest year that has data.
export const GET = json(async (req, ctx) => {
  const carId = await readId(ctx);
  const db = getDb();
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : getLatestDataYear(db);
  return getCarStats(db, carId, year);
});
