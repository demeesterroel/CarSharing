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

  let owner = false;
  if (session.personName) {
    owner = isOwner(getDb(), session.personName);
  }

  return NextResponse.json({
    personId: session.personId ?? null,
    personName: session.personName ?? null,
    isAdmin: session.isAdmin ?? false,
    isOwner: owner,
  });
}
