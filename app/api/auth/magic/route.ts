import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { getPersonByEmail, createAuthToken } from "@/lib/queries/people";
import { sendMail } from "@/lib/mailer";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().email() });

/**
 * Requests a passwordless magic-link sign-in. Like /forgot, always returns 200
 * with no detail to avoid account enumeration.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`${ip}:/api/auth/magic`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let email: string;
  try {
    email = Schema.parse(await req.json()).email;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  const person = getPersonByEmail(db, email);
  if (person) {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
    createAuthToken(db, person.id, token, expiresAt, "magic");
    const baseUrl = env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
    const url = `${baseUrl}/api/auth/magic/${token}`;
    await sendMail({
      to: email,
      subject: "Your CarSharing sign-in link",
      text: `Click to sign in (valid for 15 minutes):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    });
  }

  return NextResponse.json({ ok: true });
}
