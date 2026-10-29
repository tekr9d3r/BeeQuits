import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  // OAuth round trip: CSRF state and where to go afterwards.
  oauthState?: string;
  returnTo?: string;
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: "beequits",
    cookieOptions: { secure: process.env.NODE_ENV === "production", sameSite: "lax" },
  });
}
