import { generateCsrfToken } from "@/lib/csrf";
import { getDb } from "@/lib/db";
import { isMailEnabled } from "@/lib/mailer";
import { getSessionEpoch, isActivePerson, isOwner, shortNameOf } from "@/lib/queries/people";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";

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
    themePreference: (row.theme_preference === "paper" ? "paper" : "mono") as "paper" | "mono",
  };
}

function withCsrfCookie(req: Request, response: NextResponse): NextResponse {
  // Issue the double-submit CSRF token once and reuse it. Rotating it on every
  // /api/me call races with React Query's refetch-on-focus (e.g. after a file
  // picker), breaking validation on the next save with invalid_csrf (#333).
  const hasToken = /(?:^|;\s*)csrf-token=/.test(req.headers.get("cookie") ?? "");
  if (!hasToken) {
    response.cookies.set("csrf-token", generateCsrfToken(), {
      httpOnly: false,
      sameSite: "strict",
      path: "/",
    });
  }
  return response;
}

export async function GET(req: Request) {
  // Use the final response when reading the session so cookie writes (destroy) attach to it.
  const out = NextResponse.json(null);
  const session = await getIronSession<SessionData>(req, out, sessionOptions);
  if (!session.authenticated) {
    return withCsrfCookie(req, out);
  }

  // Reject phantom sessions — person deleted, deactivated, or missing after cookie was issued.
  // Destroy the session so the client is forced to log in again.
  if (!session.personId || !isActivePerson(getDb(), session.personId)) {
    session.destroy();
    await session.save();
    return withCsrfCookie(req, out);
  }

  // Honour server-side session revocation ("log out everywhere"): if this
  // cookie's epoch is stale, destroy it and report as logged out.
  if (session.epoch !== undefined && session.personId !== undefined) {
    if (getSessionEpoch(getDb(), session.personId) !== session.epoch) {
      // Persist the destroy to the bound response (`out`) — returning a fresh
      // NextResponse would drop the cleared-cookie header, leaving the client a
      // "valid" cookie that the Edge proxy keeps treating as authenticated (#284).
      session.destroy();
      await session.save();
      return withCsrfCookie(req, out);
    }
  }

  const cloaked = session.cloakedAs;

  if (cloaked) {
    // While cloaked, return the cloaked person's identity.
    // isOwner is computed from their personId; isAdmin reflects their actual role.
    const cloakedOwner = isOwner(getDb(), cloaked.personId);
    const { shortName: cloakedShortName, themePreference } = getPersonFields(cloaked.personId);
    return withCsrfCookie(
      req,
      NextResponse.json({
        personId: cloaked.personId,
        shortName: cloakedShortName ?? cloaked.shortName,
        isAdmin: cloaked.isAdmin,
        isOwner: cloakedOwner,
        isCloaked: true,
        themePreference,
        mailEnabled: isMailEnabled(),
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
    req,
    NextResponse.json({
      personId: session.personId ?? null,
      shortName: fields.shortName,
      isAdmin: session.isAdmin ?? false,
      isOwner: owner,
      isCloaked: false,
      themePreference: fields.themePreference,
      mailEnabled: isMailEnabled(),
    })
  );
}
