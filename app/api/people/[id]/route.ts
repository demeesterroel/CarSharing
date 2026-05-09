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
  const firstName = data.first_name ?? existing.first_name;
  const lastName = data.last_name ?? existing.last_name;
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  updatePerson(getDb(), id, {
    ...existing,
    ...data,
    first_name: firstName,
    last_name: lastName,
    name: fullName,
    username: data.username ?? existing.username,
    is_admin: data.is_admin ?? existing.is_admin,
  });
  return { ok: true };
});
