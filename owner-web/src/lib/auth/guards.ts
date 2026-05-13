import { redirect } from "next/navigation";

import { getSession } from "./session";

/**
 * Server-side route guards. Used at the top of authenticated Server
 * Components (e.g. the (owner) layout).
 */
export async function requireSession(redirectTo = "/login") {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}

export async function requireOwnerSession(redirectTo = "/login?error=owner_required") {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.is_owner) redirect(redirectTo);
  return session;
}

export async function requireNoSession(redirectTo = "/dashboard") {
  if (await getSession()) redirect(redirectTo);
}
