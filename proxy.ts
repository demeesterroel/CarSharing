import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Paths that are always accessible — no auth check.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/api/docs",
  "/docs",
  "/invite",
  "/api/invite",
  "/api/admin/calendar-renew",
  "/api/calendar-id",
];

// Pages only admins can visit (non-admins get redirected to /).
const ADMIN_ONLY_PAGES = ["/vehicles", "/people", "/payments"];

export async function proxy(req: NextRequest) {
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

  // Reject sessions that lack a personId — env-var fallback admin sessions
  // without a person row, or phantom sessions where the person was removed.
  // (Per-row DB validity is enforced downstream in requireSession; Edge runtime
  // can't reach SQLite.)
  const loginRedirect = NextResponse.redirect(new URL("/login", req.url));
  const session = await getIronSession<SessionData>(req, loginRedirect, sessionOptions);

  if (!session.authenticated) {
    return loginRedirect;
  }
  if (!session.personId) {
    session.destroy();
    await session.save();
    return loginRedirect;
  }

  const res = NextResponse.next();
  // Re-read session on the pass-through response so downstream cookie ops are wired correctly.
  await getIronSession<SessionData>(req, res, sessionOptions);

  // Admin-only pages — redirect non-admins to dashboard
  if (ADMIN_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // While cloaking as a non-admin, block admin-only pages (redirect to dashboard).

  if (session.cloakedAs && !session.cloakedAs.isAdmin) {
    const adminOnlyPaths = ["/admin/vehicles", "/admin/members", "/admin/payout"];
    if (adminOnlyPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon.*\\.png|manifest\\.webmanifest|manifest\\.json|sw\\.js|sw-helpers\\.js|workbox-.*).*)",
  ],
};
