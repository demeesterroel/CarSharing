import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

export function generateCsrfToken(): string {
  return randomBytes(24).toString("hex");
}

export function validateCsrfToken(req: NextRequest): boolean {
  const cookie = req.cookies.get("csrf-token")?.value;
  const header = req.headers.get("x-csrf-token");
  return !!cookie && !!header && cookie === header;
}
