import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getPersonById, createInviteToken } from "@/lib/queries/people";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { json, readId } from "@/lib/api";

export const POST = json(async (req, ctx) => {
  const session = await getIronSession<SessionData>(req, NextResponse.next(), sessionOptions);
  if (!session.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = await readId(ctx);
  const person = getPersonById(getDb(), id);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  createInviteToken(getDb(), id, token, expiresAt);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${new URL(req.url).origin}`;
  const url = `${baseUrl}/invite/${token}`;
  return NextResponse.json({ url });
});
