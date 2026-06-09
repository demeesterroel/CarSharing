import { json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getEarliestYear } from "@/lib/queries/dashboard";

export const GET = json(async () => {
  return { year: getEarliestYear(getDb()) };
});
