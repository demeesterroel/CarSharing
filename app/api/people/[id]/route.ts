import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { json, readBody, readId, notFound, requireAdmin } from "@/lib/api";
import { personSchema } from "@/lib/schemas/person";

export const GET = json(async (_req, ctx) => {
  const person = getPersonById(getDb(), await readId(ctx));
  if (!person) notFound();
  return person;
});

export const PUT = json(async (req, ctx) => {
  await requireAdmin(req);
  const id = await readId(ctx);
  const data = await readBody(req, personSchema);
  const existing = getPersonById(getDb(), id);
  if (!existing) notFound();
  updatePerson(getDb(), id, {
    ...existing,
    ...data,
    username: data.username ?? existing.username,
    is_admin: data.is_admin ?? existing.is_admin,
  });
  return { ok: true };
});
