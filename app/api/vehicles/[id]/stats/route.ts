import { json, readId } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarStats } from "@/lib/queries/cars";

export const GET = json(async (req, ctx) => {
  const carId = await readId(ctx);
  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  return getCarStats(getDb(), carId, year);
});
