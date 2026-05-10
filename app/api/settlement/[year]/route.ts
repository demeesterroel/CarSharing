import { getDb } from "@/lib/db";
import { getSettlement, lockSettlement, unlockSettlement } from "@/lib/queries/settlement";
import { json, requireAdminOrOwner, requireAdmin, badRequest } from "@/lib/api";

export const GET = json(async (req, ctx) => {
  await requireAdminOrOwner(req);
  const year = Number((await ctx.params).year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    badRequest("Invalid year");
  }
  return getSettlement(getDb(), year);
});

export const POST = json(async (req, ctx) => {
  const session = await requireAdmin(req);
  const year = Number((await ctx.params).year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    badRequest("Invalid year");
  }
  const result = getSettlement(getDb(), year);
  if (result.frozen) {
    unlockSettlement(getDb(), year);
  } else {
    lockSettlement(getDb(), year, session.shortName ?? "admin");
  }
  return { ok: true };
});
