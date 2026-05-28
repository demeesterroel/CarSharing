import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getPeople, insertPerson } from "@/lib/queries/people";
import { json, readBody, requireAdmin } from "@/lib/api";
import { personSchema } from "@/lib/schemas/person";

export const GET = json(async (req) => {
  const session = await getIronSession<SessionData>(req, NextResponse.next(), sessionOptions);
  const people = getPeople(getDb());
  // The people list is consumed by forms across the app (driver/owner pickers),
  // so it stays readable by any authenticated user — but contact and banking
  // details are admin-only. Strip them for everyone else.
  if (!session.isAdmin) {
    return people.map(({ email: _e, bank_account: _b, ...rest }) => rest);
  }
  return people;
});

export const POST = json(async (req) => {
  await requireAdmin(req);
  const data = await readBody(req, personSchema);
  const id = insertPerson(getDb(), {
    ...data,
    password_hash: null,
    username: data.username ?? null,
    is_admin: data.is_admin ?? 0,
    email: data.email ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
});
