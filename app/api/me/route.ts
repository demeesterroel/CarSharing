import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { isOwner, shortNameOf, getSessionEpoch } from "@/lib/queries/people";
import { generateCsrfToken } from "@/lib/csrf";

function getPersonFields(personId: number): {
  shortName: string | null;
  themePreference: "paper" | "mono" | null;
} {
  const row = getDb()
    .prepare("SELECT first_name, last_name, username, theme_preference FROM people WHERE id = ?")
    .get(personId) as
    | {
        first_name: string;
        last_name: string;
        username: string | null;
        theme_preference: string | null;
      }
    | undefined;
  if (!row) return { shortName: null, themePreference: null };
  return {
    shortName: shortNameOf(row) || null,
    themePreference: (row.theme_preference === "mono" ? "mono" : "paper") as "paper" | "mono",
  };
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

  // Honour server-side session revocation ("log out everywhere"): if this
  // cookie's epoch is stale, destroy it and report as logged out.
  if (session.epoch !== undefined && session.personId !== undefined) {
    if (getSessionEpoch(getDb(), session.personId) !== session.epoch) {
      session.destroy();
      return withCsrfCookie(NextResponse.json(null));
    }
  }

  const cloaked = session.cloakedAs;

  if (cloaked) {
    // While cloaked, return the cloaked person's identity.
    // isOwner is computed from their personId; isAdmin reflects their actual role.
    const cloakedOwner = isOwner(getDb(), cloaked.personId);
    const { shortName: cloakedShortName, themePreference } = getPersonFields(cloaked.personId);
    return withCsrfCookie(
      NextResponse.json({
        personId: cloaked.personId,
        shortName: cloakedShortName ?? cloaked.shortName,
        isAdmin: cloaked.isAdmin,
        isOwner: cloakedOwner,
        isCloaked: true,
        themePreference,
      })
    );
  }

  let owner = false;
  if (session.personId) {
    owner = isOwner(getDb(), session.personId);
  }

  const fields = session.personId
    ? getPersonFields(session.personId)
    : { shortName: session.shortName ?? null, themePreference: null };
  return withCsrfCookie(
    NextResponse.json({
      personId: session.personId ?? null,
      shortName: fields.shortName,
      isAdmin: session.isAdmin ?? false,
      isOwner: owner,
      isCloaked: false,
      themePreference: fields.themePreference,
    })
  );
}
