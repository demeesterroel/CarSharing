import type { SessionOptions } from "iron-session";

export interface SessionData {
  // Phase B widens this with personId?: number and isAdmin?: boolean
  // without breaking any Phase A consumer — only authenticated is checked here.
  authenticated: boolean;
}

export const sessionOptions: SessionOptions = {
  cookieName: "autodelen_session",
  password: process.env.SESSION_PASSWORD as string,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
