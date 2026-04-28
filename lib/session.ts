import type { SessionOptions } from "iron-session";
import { env } from "./env";

export interface SessionData {
  authenticated: boolean;
  personId?: number;
  personName?: string;
  isAdmin?: boolean;
  /** Set while an admin is impersonating another person. */
  cloakedAs?: {
    personId: number;
    personName: string;
    isAdmin: boolean;
  };
}

export const sessionOptions: SessionOptions = {
  cookieName: "carsharing_session",
  password: env.SESSION_PASSWORD,
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
