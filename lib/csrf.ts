import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

/** Generates a cryptographically random 48-character hex CSRF token. */
export function generateCsrfToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Validates that the `x-csrf-token` header matches the `csrf-token` cookie.
 * @param req - Incoming Next.js or plain Request (falls back to parsing the Cookie header).
 * @returns `true` if the token is present and matches.
 */
export function validateCsrfToken(req: NextRequest): boolean {
  // NextRequest has .cookies; plain Request (tests) doesn't — fall back to Cookie header
  const cookieFromParsed = req.cookies?.get("csrf-token")?.value;
  const cookieFromHeader = parseCookieHeader(req.headers.get("cookie") ?? "")["csrf-token"];
  const cookie = cookieFromParsed ?? cookieFromHeader;
  const header = req.headers.get("x-csrf-token");
  return !!cookie && !!header && cookie === header;
}

function parseCookieHeader(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw
      .split(";")
      .map((c) => c.trim().split("="))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), decodeURIComponent(v.trim())])
  );
}
