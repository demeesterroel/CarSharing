import { getDb } from "@/lib/db";
import { getDashboard } from "@/lib/queries/dashboard";
import { json } from "@/lib/api";

export const GET = json(async (req) => {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  return getDashboard(getDb(), year);
});
