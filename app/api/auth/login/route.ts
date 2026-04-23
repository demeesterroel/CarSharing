import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPersonByUsername, isOwner } from "@/lib/queries/people";

export async function POST(req: Request) {
  if (!process.env.SESSION_PASSWORD) {
    console.error("SESSION_PASSWORD env var is not set");
    return NextResponse.json({ error: "server_misconfiguration" }, { status: 500 });
  }

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
  let sessionPersonName: string | undefined;
  let sessionIsAdmin = false;

  if (person?.password_hash) {
    // DB-based per-person auth
    authenticated = await verifyCredentials(
      { username, password },
      { username: person.username!, passwordHash: person.password_hash }
    );
    if (authenticated) {
      sessionPersonId = person.id;
      sessionPersonName = person.name;
      sessionIsAdmin = person.is_admin === 1;
    }
  } else {
    // Env-var fallback for initial/legacy setup
    const { AUTH_USERNAME, AUTH_PASSWORD_HASH } = process.env;
    if (AUTH_USERNAME && AUTH_PASSWORD_HASH) {
      authenticated = await verifyCredentials(
        { username, password },
        { username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH }
      );
      if (authenticated) {
        sessionIsAdmin = true;
        // Try to find the person by name for env-var admin
        const adminPerson = db
          .prepare("SELECT id, name FROM people WHERE name=? LIMIT 1")
          .get(AUTH_USERNAME) as { id: number; name: string } | undefined;
        if (adminPerson) {
          sessionPersonId = adminPerson.id;
          sessionPersonName = adminPerson.name;
        }
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
  session.personName = sessionPersonName;
  session.isAdmin = sessionIsAdmin;
  await session.save();
  return res;
}
