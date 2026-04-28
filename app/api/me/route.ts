import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { getDb } from "@/lib/db";
import { isOwner } from "@/lib/queries/people";

export async function GET(req: Request) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.authenticated) {
    return NextResponse.json(null);
  }

  const cloaked = session.cloakedAs;

  if (cloaked) {
    // While cloaked, return the cloaked person's identity.
    // isOwner is computed from their name; isAdmin reflects their actual role.
    const cloakedOwner = isOwner(getDb(), cloaked.personName);
    return NextResponse.json({
      personId: cloaked.personId,
      personName: cloaked.personName,
      isAdmin: cloaked.isAdmin,
      isOwner: cloakedOwner,
      isCloaked: true,
    });
  }

  let owner = false;
  if (session.personName) {
    owner = isOwner(getDb(), session.personName);
  }

  return NextResponse.json({
    personId: session.personId ?? null,
    personName: session.personName ?? null,
    isAdmin: session.isAdmin ?? false,
    isOwner: owner,
    isCloaked: false,
  });
}
