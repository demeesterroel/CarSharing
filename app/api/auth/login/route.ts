import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPersonByUsername, isOwner, shortNameOf } from "@/lib/queries/people";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const db = getDb();
  const person = getPersonByUsername(db, username);

  let authenticated = false;
  let sessionPersonId: number | undefined;
  let sessionShortName: string | undefined;
  let sessionIsAdmin = false;

  if (person?.password_hash) {
    // DB-based per-person auth
    authenticated = await verifyCredentials(
      { username, password },
      { username: person.username!, passwordHash: person.password_hash }
    );
    if (authenticated) {
      sessionPersonId = person.id;
      sessionShortName = shortNameOf(person);
      sessionIsAdmin = person.is_admin === 1;
    }
  } else {
    // Env-var fallback for initial/legacy setup
    const { AUTH_USERNAME, AUTH_PASSWORD_HASH } = env;
    if (AUTH_USERNAME && AUTH_PASSWORD_HASH) {
      authenticated = await verifyCredentials(
        { username, password },
        { username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH }
      );
      if (authenticated) {
        sessionIsAdmin = true;
        // Try to find a person row by username or first_name
        const adminPerson = db
          .prepare("SELECT id, first_name, last_name, username FROM people WHERE username=? OR first_name=? LIMIT 1")
          .get(AUTH_USERNAME, AUTH_USERNAME) as { id: number; first_name?: string; last_name?: string; username?: string | null } | undefined;
        sessionPersonId = adminPerson?.id;
        sessionShortName = adminPerson ? shortNameOf(adminPerson) : AUTH_USERNAME;
      }
    }
  }

  if (!authenticated) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  session.personId = sessionPersonId;
  session.shortName = sessionShortName;
  session.isAdmin = sessionIsAdmin;
  await session.save();
  return res;
}
