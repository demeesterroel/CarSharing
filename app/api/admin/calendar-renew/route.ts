// app/api/admin/calendar-renew/route.ts
import { resolveBaseUrl } from "@/lib/base-url";
import { handleCalendarRenew } from "@/lib/calendar-renew";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = resolveBaseUrl(req);
  try {
    const result = await handleCalendarRenew(getDb(), baseUrl);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[calendar-renew] unhandled error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
