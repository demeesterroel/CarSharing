import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { NextRequest, NextResponse } from "next/server";

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
  // Google Calendar push notifications (events.watch webhook). The POST arrives
  // with no session cookie, so it must bypass the auth redirect or inbound 2-way
  // sync is dead (#339). The handler has its own auth: it validates the
  // x-goog-channel-id header against the stored channel_id.
  "/api/calendar-webhook",
  // Self-service password reset / magic-link sign-in (issue #267).
  "/forgot",
  "/reset",
  "/magic",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/api/auth/magic",
];

// Pages only admins can visit (non-admins get redirected to /).
const ADMIN_ONLY_PAGES = ["/vehicles", "/people", "/payments"];

// Guest-only pages — authenticated users get redirected to / (mirror of
// protected routes redirecting logged-out users to /login). The /api/auth/*
// endpoints and the magic-link consume route stay accessible.
const GUEST_ONLY_PAGES = ["/login", "/forgot", "/reset"];

import { extractTenantSlug } from "@/lib/tenant-context";
import { getTenantConfigForHost } from "@/lib/tenants-config";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const tenantSlug = extractTenantSlug(req);
  const siteConfig = getTenantConfigForHost(host);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-slug", tenantSlug);
  if (siteConfig?.name) {
    requestHeaders.set("x-tenant-name", siteConfig.name);
  }

  // Static assets and Next.js internals are excluded via the matcher below.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (GUEST_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set("x-tenant-slug", tenantSlug);
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (session.authenticated) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-tenant-slug", tenantSlug);
    return res;
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
  // Cross-tenant session protection: if session was issued for a different tenant, destroy and redirect to login
  if (session.tenantSlug && session.tenantSlug !== tenantSlug) {
    session.destroy();
    await session.save();
    return loginRedirect;
  }
  if (!session.personId) {
    session.destroy();
    await session.save();
    return loginRedirect;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-tenant-slug", tenantSlug);
  // Re-read session on the pass-through response so downstream cookie ops are wired correctly.
  await getIronSession<SessionData>(req, res, sessionOptions);

  // Admin-only pages — redirect non-admins to dashboard
  if (ADMIN_ONLY_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // While cloaking as a non-admin, block admin-only pages (redirect to dashboard).
  // /admin/vehicles is an OWNER page, so it stays open to a cloaked car owner —
  // matching the access the impersonated person has when logged in directly (#179).
  if (session.cloakedAs && !session.cloakedAs.isAdmin) {
    const blockedPaths = ["/admin/members", "/admin/payout"];
    if (!session.cloakedAs.isOwner) {
      blockedPaths.push("/admin/vehicles");
    }
    if (blockedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
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
