import { getDb } from "@/lib/db";
import { getEarliestYear } from "@/lib/queries/dashboard";
import { json } from "@/lib/api";

export const GET = json(async () => {
  return { year: getEarliestYear(getDb()) };
});
