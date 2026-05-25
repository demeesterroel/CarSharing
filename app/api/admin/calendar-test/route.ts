import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { json, requireAdmin } from "@/lib/api";
import { getSetting } from "@/lib/queries/settings";
import { getOAuthClient } from "@/lib/google-calendar";

function googleErrorCode(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    const status = response?.status;
    if (status === 404) return "calendar_not_found";
    if (status === 403) return "calendar_no_access";
    const data = response?.data;
    if (data && typeof data === "object" && "error" in data) {
      const errVal = (data as Record<string, unknown>).error;
      if (typeof errVal === "string") return errVal;
      // Google JSON error format: { error: { code, message, status } }
      if (errVal && typeof errVal === "object") {
        const errObj = errVal as Record<string, unknown>;
        return `${errObj.status ?? errObj.code ?? "unknown"}`;
      }
    }
  }
  return "unknown";
}

export const GET = json(async (req) => {
  await requireAdmin(req);
  const db = getDb();

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return NextResponse.json({ ok: false, error: "no_env_credentials" });

  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");

  if (!calendarId) return NextResponse.json({ ok: false, error: "no_calendar_id" });
  if (!refreshToken) return NextResponse.json({ ok: false, error: "no_token" });

  try {
    const client = getOAuthClient(refreshToken);
    const cal = google.calendar({ version: "v3", auth: client });
    const res = await cal.calendars.get({ calendarId });
    const role = (res.data as Record<string, unknown>).accessRole as string | undefined;
    if (role === "reader" || role === "freeBusyReader" || role === "none") {
      return NextResponse.json({ ok: false, error: "no_write_access" });
    }
    return NextResponse.json({ ok: true, summary: res.data.summary ?? calendarId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: googleErrorCode(e) });
  }
});
