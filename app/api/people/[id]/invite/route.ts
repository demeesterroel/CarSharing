import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getPersonById, createInviteToken } from "@/lib/queries/people";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { json, readId } from "@/lib/api";
import { env } from "@/lib/env";
import { sendMail, isMailEnabled } from "@/lib/mailer";

export const POST = json(async (req, ctx) => {
  const session = await getIronSession<SessionData>(req, NextResponse.next(), sessionOptions);
  if (!session.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = await readId(ctx);
  const person = getPersonById(getDb(), id);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The invite flow only sets a password, never a username — so a member must
  // already have one, otherwise they could never log in.
  if (!person.username) return NextResponse.json({ error: "no_username" }, { status: 400 });

  // Optional: email the invite instead of returning a copyable link.
  let send = false;
  try {
    const body = await req.json();
    send = body?.send === true;
  } catch {
    // no body → copy-link behaviour
  }

  if (send) {
    if (!person.email) return NextResponse.json({ error: "no_email" }, { status: 400 });
    if (!isMailEnabled()) return NextResponse.json({ error: "mail_disabled" }, { status: 400 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  createInviteToken(getDb(), id, token, expiresAt);

  const baseUrl = env.NEXT_PUBLIC_BASE_URL ?? `${new URL(req.url).origin}`;
  const url = `${baseUrl}/invite/${token}`;

  if (send) {
    const usernameLine = person.username ? `Your username: ${person.username}\n\n` : "";
    await sendMail({
      to: person.email!,
      subject: "You're invited to CarSharing",
      text: `You've been invited to CarSharing.\n\n${usernameLine}Open this link to set your password and sign in (valid for 7 days):\n\n${url}\n\nIf you weren't expecting this, you can ignore this email.`,
    });
    return NextResponse.json({ sent: true });
  }

  return NextResponse.json({ url });
});
