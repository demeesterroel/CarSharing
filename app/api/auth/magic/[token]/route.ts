import { resolveBaseUrl } from "@/lib/base-url";
import { getDb } from "@/lib/db";
import {
  deleteAuthToken,
  getAuthToken,
  getPersonById,
  getSessionEpoch,
  shortNameOf,
} from "@/lib/queries/people";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";

/**
 * Consumes a magic-link token (the URL emailed to the user) and establishes a
 * session, then redirects to the app. Single-use; expired/invalid tokens are
 * discarded and the user is sent to /login.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = getDb();
  const baseUrl = resolveBaseUrl(req);

  const record = getAuthToken(db, token);
  const invalid = !record || record.purpose !== "magic" || new Date(record.expires_at) < new Date();
  if (invalid) {
    if (record) deleteAuthToken(db, token);
    return NextResponse.redirect(new URL("/login?error=magic", baseUrl));
  }

  const person = getPersonById(db, record!.person_id);
  if (!person) {
    deleteAuthToken(db, token);
    return NextResponse.redirect(new URL("/login?error=magic", baseUrl));
  }

  const res = NextResponse.redirect(new URL("/", baseUrl));
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  session.personId = person.id;
  session.shortName = shortNameOf(person);
  session.isAdmin = person.is_admin === 1;
  session.epoch = getSessionEpoch(db, person.id);
  await session.save();
  deleteAuthToken(db, token);
  return res;
}
