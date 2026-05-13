import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { json, readBody, readId, notFound, forbidden } from "@/lib/api";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().default(""),
  bank_account: z.string().default(""),
  email: z
    .string()
    .email()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  theme_preference: z.enum(["paper", "mono"]).optional().default("paper"),
});

export const PATCH = json(async (req, ctx) => {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const id = await readId(ctx);
  if (!session.authenticated) forbidden("Unauthorized");
  if (session.personId !== id && !session.isAdmin) forbidden("Forbidden");
  const data = await readBody(req, profileSchema);
  const existing = getPersonById(getDb(), id);
  if (!existing) notFound();
  updatePerson(getDb(), id, {
    ...existing,
    first_name: data.first_name,
    last_name: data.last_name,
    bank_account: data.bank_account,
    email: data.email ?? null,
    theme_preference: data.theme_preference,
  });
  return { ok: true };
});
