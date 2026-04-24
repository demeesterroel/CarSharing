import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getCarPnL, getKmGaps, getZeroKmTrips,
  getMonthlyCarKm, getPersonContributions, getHistoricalCarKm,
  getPriceHistory,
} from "@/lib/queries/admin";
import { getDashboard } from "@/lib/queries/dashboard";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const db = getDb();

  return NextResponse.json({
    carPnL: getCarPnL(db, year),
    settlement: getDashboard(db, year),
    kmGaps: getKmGaps(db),
    zeroKmTrips: getZeroKmTrips(db),
    monthlyCarKm: getMonthlyCarKm(db, year),
    personContributions: getPersonContributions(db, year),
    historicalCarKm: getHistoricalCarKm(db, year),
    priceHistory: getPriceHistory(db),
  });
}
