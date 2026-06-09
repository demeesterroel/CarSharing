import { getDb } from "@/lib/db";
import {
  bumpSessionEpoch,
  deleteAuthToken,
  getAuthToken,
  getPersonById,
  getSessionEpoch,
  setPasswordHash,
  shortNameOf,
} from "@/lib/queries/people";
import { sessionOptions, type SessionData } from "@/lib/session";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { z } from "zod";

const Schema = z.object({ password: z.string().min(8) });

/** Completes a password reset: sets the new password and revokes old sessions. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = getDb();

  const record = getAuthToken(db, token);
  if (!record || record.purpose !== "reset") {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (new Date(record.expires_at) < new Date()) {
    deleteAuthToken(db, token);
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const hash = await bcrypt.hash(parsed.data.password, 12);
  db.transaction((args: { personId: number; hash: string; token: string }) => {
    setPasswordHash(db, args.personId, args.hash);
    // A password reset invalidates every existing session for the account.
    bumpSessionEpoch(db, args.personId);
    deleteAuthToken(db, args.token);
  })({ personId: record.person_id, hash, token });

  const person = getPersonById(db, record.person_id);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, person_id: person.id });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  session.personId = person.id;
  session.shortName = shortNameOf(person);
  session.isAdmin = person.is_admin === 1;
  session.epoch = getSessionEpoch(db, person.id);
  await session.save();
  return res;
}
