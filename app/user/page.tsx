import { sessionOptions, type SessionData } from "@/lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Reads the session cookie, so it must render per-request.
export const dynamic = "force-dynamic";

/**
 * `/user` has no page of its own — it sends the signed-in member to their own
 * profile edit page. Unauthenticated visitors are denied and sent to /login.
 */
export default async function UserIndexPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  // While cloaked, edit the impersonated person; otherwise the real session person.
  const personId = session.cloakedAs?.personId ?? session.personId;

  if (!session.authenticated || !personId) {
    redirect("/login");
  }

  redirect(`/user/${personId}/edit`);
}
