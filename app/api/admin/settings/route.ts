import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, readBody, requireAdmin, requireAdminOrOwner } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/queries/settings";

const settingsSchema = z.object({
  coop_bank_account: z.string().max(200),
});

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const db = getDb();
  return NextResponse.json({
    coop_bank_account: getSetting(db, "coop_bank_account"),
  });
});

export const PUT = json(async (req) => {
  await requireAdmin(req);
  const { coop_bank_account } = await readBody(req, settingsSchema);
  setSetting(getDb(), "coop_bank_account", coop_bank_account);
  return NextResponse.json({ ok: true });
});
