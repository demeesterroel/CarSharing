import {
  json,
  readId,
  requireSession,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarById, getCarStats } from "@/lib/queries/cars";

export const GET = json(async (req, ctx) => {
  await requireSession(req);
  const id = await readId(ctx);
  const db = getDb();
  const car = getCarById(db, id);
  if (!car) return; // notFound is handled by json wrapper if needed, but let's be safe

  // For now, we need a year. The requirement says "defaulting to the latest year with data" on the frontend.
  // On the API, we should probably accept a year as a query param.
  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year)) return;

  const stats = getCarStats(db, id, year);
  return { car, stats, year };
});
