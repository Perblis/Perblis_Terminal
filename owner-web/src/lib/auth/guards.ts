import { redirect } from "next/navigation";

import { hasSession } from "./session";

/**
 * Server-side route guards. Used at the top of authenticated Server
 * Components (e.g. the (owner) layout). Wave 01 wires these in.
 */
export async function requireSession(redirectTo = "/login"): Promise<void> {
  if (!(await hasSession())) redirect(redirectTo);
}

export async function requireNoSession(redirectTo = "/dashboard"): Promise<void> {
  if (await hasSession()) redirect(redirectTo);
}
