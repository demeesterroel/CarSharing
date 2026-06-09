import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (session.authenticated) {
    session.destroy();
  }
  return res;
}
