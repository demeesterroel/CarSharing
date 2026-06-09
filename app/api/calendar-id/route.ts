import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/queries/settings";
import { NextResponse } from "next/server";

export function GET() {
  const db = getDb();
  const calendarId = getSetting(db, "google_calendar_id");
  return NextResponse.json({ calendarId: calendarId || null });
}
