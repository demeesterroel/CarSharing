import { getCarStats } from "@/lib/queries/cars";
import { getDb } from "@/lib/db";
import { json, readId } from "@/lib/api";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const { searchParams } = new URL(_req.url);
  const yearParam = searchParams.get("year");
  
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  
  const db = getDb();
  const stats = getCarStats(db, id, year);
  
  return stats;
});