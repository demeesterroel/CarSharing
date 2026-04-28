import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getPersonById } from "@/lib/queries/people";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated || !session.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { personId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const targetId = typeof body.personId === "number" ? body.personId : null;
  if (!targetId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const person = getPersonById(getDb(), targetId);
  if (!person || !person.active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  session.cloakedAs = {
    personId: person.id,
    personName: person.name,
    isAdmin: person.is_admin === 1,
  };
  await session.save();
  return res;
}
