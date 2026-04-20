import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";

export async function POST(req: Request) {
  const { AUTH_USERNAME, AUTH_PASSWORD_HASH } = process.env;
  if (!AUTH_USERNAME || !AUTH_PASSWORD_HASH || !process.env.SESSION_PASSWORD) {
    console.error("AUTH_USERNAME, AUTH_PASSWORD_HASH, or SESSION_PASSWORD env vars are not set");
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

  const ok = await verifyCredentials(
    { username, password },
    { username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH }
  );

  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.authenticated = true;
  await session.save();
  return res;
}
