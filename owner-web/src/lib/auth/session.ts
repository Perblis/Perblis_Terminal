import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/api/auth";

const NAME = process.env.SESSION_COOKIE_NAME ?? "terminal_session";
const SECURE = process.env.SESSION_COOKIE_SECURE === "true";

export type SessionPayload = {
  access: string;
  refresh: string;
  user: SessionUser;
};

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — matches the refresh token lifetime.

export async function setSession(payload: SessionPayload): Promise<void> {
  const c = await cookies();
  c.set(NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const raw = c.get(NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(NAME);
}

export async function hasSession(): Promise<boolean> {
  return (await getSession()) !== null;
}

export const SESSION_COOKIE = NAME;
