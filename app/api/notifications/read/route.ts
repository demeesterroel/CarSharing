import { json, requireSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { markRead } from "@/lib/queries/notifications";
import { z } from "zod";

const readSchema = z.object({
  ids: z.array(z.number().int().positive()).optional(),
});

export const POST = json(async (req) => {
  const session = await requireSession(req);
  const raw = await req.json();
  const { ids } = readSchema.parse(raw);
  markRead(getDb(), session.personId!, ids);
  return { ok: true };
});
