import { json, readBody, requireAdmin, requireAdminOrOwner } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getSetting, setSetting } from "@/lib/queries/settings";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  coop_bank_account: z.string().max(200).optional(),
  google_calendar_id: z.string().max(200).optional(),
  google_oauth_refresh_token: z.string().max(2000).optional(),
});

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const db = getDb();
  return NextResponse.json({
    coop_bank_account: getSetting(db, "coop_bank_account"),
    google_calendar_id: getSetting(db, "google_calendar_id"),
    google_oauth_refresh_token: getSetting(db, "google_oauth_refresh_token"),
    env_credentials_ok: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
});

export const PUT = json(async (req) => {
  await requireAdmin(req);
  const data = await readBody(req, settingsSchema);
  const db = getDb();
  if (data.coop_bank_account !== undefined)
    setSetting(db, "coop_bank_account", data.coop_bank_account);
  if (data.google_calendar_id !== undefined)
    setSetting(db, "google_calendar_id", data.google_calendar_id);
  if (data.google_oauth_refresh_token !== undefined)
    setSetting(db, "google_oauth_refresh_token", data.google_oauth_refresh_token);
  return NextResponse.json({ ok: true });
});
