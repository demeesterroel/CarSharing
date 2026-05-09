// app/api/admin/calendar-renew/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { handleCalendarRenew } from "@/lib/calendar-renew";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const result = await handleCalendarRenew(getDb(), baseUrl);
  return NextResponse.json(result);
}
