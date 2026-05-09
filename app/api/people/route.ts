import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPeople, insertPerson } from "@/lib/queries/people";
import { json, readBody, requireAdmin } from "@/lib/api";
import { personSchema } from "@/lib/schemas/person";

export const GET = json(async () => getPeople(getDb()));

export const POST = json(async (req) => {
  await requireAdmin(req);
  const data = await readBody(req, personSchema);
  const fullName = data.last_name
    ? `${data.first_name} ${data.last_name}`
    : data.first_name;
  const id = insertPerson(getDb(), {
    ...data,
    name: data.name ?? fullName,
    password_hash: null,
    username: data.username ?? null,
    is_admin: data.is_admin ?? 0,
    email: data.email ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
});
