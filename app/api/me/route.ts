import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { isOwner, shortNameOf } from "@/lib/queries/people";
import { generateCsrfToken } from "@/lib/csrf";

function getPersonFields(personId: number): { shortName: string | null } {
  const row = getDb()
    .prepare("SELECT first_name, last_name, username FROM people WHERE id = ?")
    .get(personId) as { first_name: string; last_name: string; username: string | null } | undefined;
  if (!row) return { shortName: null };
  return { shortName: shortNameOf(row) || null };
}

function withCsrfCookie(response: NextResponse): NextResponse {
  const token = generateCsrfToken();
  response.cookies.set("csrf-token", token, {
    httpOnly: false,
    sameSite: "strict",
    path: "/",
  });
  return response;
}

export async function GET(req: Request) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated) {
    return withCsrfCookie(NextResponse.json(null));
  }

  const cloaked = session.cloakedAs;

  if (cloaked) {
    // While cloaked, return the cloaked person's identity.
    // isOwner is computed from their personId; isAdmin reflects their actual role.
    const cloakedOwner = isOwner(getDb(), cloaked.personId);
    return withCsrfCookie(
      NextResponse.json({
        personId: cloaked.personId,
        shortName: getPersonFields(cloaked.personId).shortName ?? cloaked.shortName,
        isAdmin: cloaked.isAdmin,
        isOwner: cloakedOwner,
        isCloaked: true,
      })
    );
  }

  let owner = false;
  if (session.personId) {
    owner = isOwner(getDb(), session.personId);
  }

  return withCsrfCookie(
    NextResponse.json({
      personId: session.personId ?? null,
      ...(session.personId ? getPersonFields(session.personId) : { shortName: session.shortName ?? null }),
      isAdmin: session.isAdmin ?? false,
      isOwner: owner,
      isCloaked: false,
    })
  );
}
