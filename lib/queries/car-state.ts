import type Database from "better-sqlite3";
import type { CarState } from "@/types";

interface Row {
  odometer: number | null;
  location: string | null;
  source: "trip" | "fuel";
  date: string;
  source_priority: number;
  id: number;
}

export function getLastCarState(db: Database.Database, carId: number): CarState | null {
  const row = db
    .prepare(
      `
      SELECT odometer, location, source, date, source_priority, id FROM (
        SELECT end_odometer AS odometer, location, 'trip' AS source,
               date, 1 AS source_priority, id
        FROM trips
        WHERE car_id = ?
        UNION ALL
        SELECT odometer, location, 'fuel' AS source,
               date, 0 AS source_priority, id
        FROM fuel_fillups
        WHERE car_id = ? AND odometer IS NOT NULL
      )
      ORDER BY date DESC, source_priority DESC, id DESC
      LIMIT 1
      `
    )
    .get(carId, carId) as Row | undefined;

  if (!row) return null;
  return { odometer: row.odometer, location: row.location, source: row.source };
}
