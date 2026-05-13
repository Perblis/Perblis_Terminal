import { cookies } from "next/headers";

/**
 * Server-side session helpers.
 *
 * Wave 00 ships browser-side localStorage tokens (see lib/api/client.ts)
 * for speed. Wave 01 promotes these helpers to be the real source of truth,
 * setting httpOnly cookies via /api/auth/login so refresh tokens never
 * reach the browser. The cookie name is SESSION_COOKIE_NAME from .env.
 */
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "terminal_session";

export async function getSession(): Promise<string | null> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await getSession());
}
