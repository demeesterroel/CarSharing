import { json, requireAdminOrOwner } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarStats } from "@/lib/queries/cars";

export const GET = json(async (req, ctx) => {
  await requireAdminOrOwner(req);
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const carId = parseInt(id, 10);

  if (Number.isNaN(carId) || Number.isNaN(year)) {
    throw new Error("Invalid carId or year");
  }

  const db = getDb();
  return getCarStats(db, carId, year);
});
