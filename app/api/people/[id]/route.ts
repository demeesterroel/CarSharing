import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { json, readBody, readId, notFound, requireAdmin, requireSession } from "@/lib/api";
import { personSchema } from "@/lib/schemas/person";

export const GET = json(async (req, ctx) => {
  const session = await requireSession(req);
  const id = await readId(ctx);
  const person = getPersonById(getDb(), id);
  if (!person) notFound();
  // Contact and banking details are private: only the record's owner or an
  // admin may see them. Mirror the strip logic of the collection route.
  if (!session.isAdmin && session.personId !== id) {
    const { email: _e, bank_account: _b, ...rest } = person;
    return rest;
  }
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
    first_name: data.first_name ?? existing.first_name,
    last_name: data.last_name ?? existing.last_name,
    username: data.username ?? existing.username,
    is_admin: data.is_admin ?? existing.is_admin,
  });
  return { ok: true };
});
