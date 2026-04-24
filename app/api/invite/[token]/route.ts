import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getInviteToken, deleteInviteToken, setPasswordHash, getPersonById } from "@/lib/queries/people";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const Schema = z.object({
  password: z.string().min(8),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const db = getDb();

  const record = getInviteToken(db, token);
  if (!record) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (new Date(record.expires_at) < new Date()) {
    deleteInviteToken(db, token);
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const hash = await bcrypt.hash(parsed.data.password, 12);
  setPasswordHash(db, record.person_id, hash);
  deleteInviteToken(db, token);

  const person = getPersonById(db, record.person_id);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  session.personId = person.id;
  session.personName = person.name;
  session.isAdmin = person.is_admin === 1;
  await session.save();
  return res;
}
