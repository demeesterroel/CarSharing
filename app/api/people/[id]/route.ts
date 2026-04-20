import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { json, readBody, readId, notFound } from "@/lib/api";

const PersonSchema = z.object({
  name: z.string().min(1),
  discount: z.number().min(0).max(1).default(0),
  discount_long: z.number().min(0).max(1).default(0),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
});

export const GET = json(async (_req, ctx) => {
  const person = getPersonById(getDb(), await readId(ctx));
  if (!person) notFound();
  return person;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const data = await readBody(req, PersonSchema);
  updatePerson(getDb(), id, data);
  return { ok: true };
});
