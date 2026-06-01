import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { bumpSessionEpoch } from "@/lib/queries/people";
import { validateCsrfToken } from "@/lib/csrf";

/**
 * "Log out everywhere": bumps the user's session epoch (revoking every
 * previously issued cookie) and destroys the current session.
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated || session.personId === undefined) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Revoke sessions for the real user, even while cloaking as someone else.
  bumpSessionEpoch(getDb(), session.personId);
  session.destroy();
  return res;
}
