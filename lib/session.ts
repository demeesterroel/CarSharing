import type { SessionOptions } from "iron-session";
import { env } from "./env";

/** Shape of the iron-session payload stored in the encrypted cookie. */
export interface SessionData {
  authenticated: boolean;
  personId?: number;
  shortName?: string;
  isAdmin?: boolean;
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
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
