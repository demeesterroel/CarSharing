import { json, requireAdminOrOwner } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCarStats } from "@/lib/queries/cars";

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const { searchParams } = new URL(req.url);
  const carId = parseInt(searchParams.get("carId") ?? "", 10);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  
  if (isNaN(carId)) {
    throw new Error("carId is required");
  }
  
  const db = getDb();
  return getCarStats(db, carId, year);
});