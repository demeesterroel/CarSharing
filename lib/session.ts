import type { SessionOptions } from "iron-session";
import { env } from "./env";

/** Shape of the iron-session payload stored in the encrypted cookie. */
export interface SessionData {
  authenticated: boolean;
  personId?: number;
  shortName?: string;
  isAdmin?: boolean;
  /**
   * The user's session epoch at the time this cookie was issued. If it no longer
   * matches `people.session_epoch`, the session has been revoked. Absent on
   * legacy cookies issued before this field existed (treated as still valid).
   */
  epoch?: number;
  /** Set while an admin is impersonating another person. */
  cloakedAs?: {
    personId: number;
    shortName: string;
    isAdmin: boolean;
  };
}

/** iron-session configuration: cookie name, encryption password, and cookie attributes. */
export const sessionOptions: SessionOptions = {
  cookieName: "carsharing_session",
  password: env.SESSION_PASSWORD,
  cookieOptions: {
    httpOnly: true,
    // Must stay true in production: this cookie carries the auth session.
    // If reaching the dev server from a non-localhost device breaks login,
    // put a TLS terminator in front (reverse proxy, tunnel, etc.) — do not
    // weaken this flag.
    secure: env.NODE_ENV === "production",
    // Lax (not Strict): magic-link / reset sign-in lands here via a top-level
    // navigation from an external mail client; Strict would withhold the just-set
    // cookie on the redirect to "/", bouncing the user to /login. Lax still
    // blocks cross-site POSTs, and mutating routes are CSRF-token protected.
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
