import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { isOwner } from "@/lib/queries/people";
import { generateCsrfToken } from "@/lib/csrf";

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
        personName: cloaked.personName,
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
      personName: session.personName ?? null,
      isAdmin: session.isAdmin ?? false,
      isOwner: owner,
      isCloaked: false,
    })
  );
}
