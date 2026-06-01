import { getDb } from "@/lib/db";
import {
  getCarPnL,
  getKmGaps,
  getZeroKmTrips,
  getMonthlyCarKm,
  getPersonContributions,
  getHistoricalCarKm,
  getPriceHistory,
  getRollingFuelPerKm,
  getHistoricalOwnerSplit,
  getHistoricalExpenses,
  getDuplicateTrips,
} from "@/lib/queries/admin";
import { getDashboard } from "@/lib/queries/dashboard";
import { json, requireAdminOrOwner } from "@/lib/api";

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const db = getDb();

  return {
    carPnL: getCarPnL(db, year),
    settlement: getDashboard(db, year),
    kmGaps: getKmGaps(db),
    zeroKmTrips: getZeroKmTrips(db),
    duplicateTrips: getDuplicateTrips(db),
    monthlyCarKm: getMonthlyCarKm(db, year),
    personContributions: getPersonContributions(db, year),
    historicalCarKm: getHistoricalCarKm(db, year),
    priceHistory: getPriceHistory(db),
    rollingFuelPerKm: getRollingFuelPerKm(db),
    historicalOwnerSplit: getHistoricalOwnerSplit(db, year),
    historicalExpenses: getHistoricalExpenses(db, year),
  };
});
