import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  delete session.cloakedAs;
  await session.save();
  return res;
}
