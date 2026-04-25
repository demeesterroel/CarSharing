import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Paths that are always accessible — no auth check.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/invite",
  "/api/invite",
];

// Pages only admins can visit (non-admins get redirected to /).
const ADMIN_ONLY_PAGES = ["/cars", "/people", "/payments"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets and Next.js internals are excluded via the matcher below.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/login") {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (session.authenticated) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.authenticated) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only pages — redirect non-admins to dashboard
  if (ADMIN_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon.*\\.png|manifest\\.webmanifest|manifest\\.json|sw\\.js|sw-helpers\\.js|workbox-.*).*)",
  ],
};
