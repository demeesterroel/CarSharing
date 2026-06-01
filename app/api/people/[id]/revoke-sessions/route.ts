import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { bumpSessionEpoch } from "@/lib/queries/people";
import { json, readId, requireAdmin } from "@/lib/api";

/**
 * Admin "revoke sessions": bumps the target member's session epoch, invalidating
 * every cookie they hold so they must re-authenticate. Does not deactivate the
 * account or change the password. The acting admin's own session is untouched
 * unless they target themselves.
 */
export const POST = json(async (req, ctx) => {
  await requireAdmin(req);
  const id = await readId(ctx);
  bumpSessionEpoch(getDb(), id);
  return NextResponse.json({ ok: true });
});
