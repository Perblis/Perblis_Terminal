import { NextRequest, NextResponse } from "next/server";

import type { SessionPayload } from "@/lib/auth/session";

/**
 * Edge proxy — routing guard.
 *
 * Renamed from `middleware.ts` for Next.js 16, which deprecates the
 * middleware file convention in favor of `proxy`. The API is identical:
 * a single function is invoked for every matched request.
 *
 * Responsibilities (kept on the edge so unauthenticated traffic never
 * gets a chance to flash the protected UI):
 *
 *   1. No session cookie on a protected path → /login?next=…
 *   2. Session cookie on a public auth path → /dashboard
 *   3. Session cookie missing `is_owner` on a protected path → drop the
 *      cookie and bounce to /login?error=owner_required so the user can
 *      sign in with an owner-enabled account.
 *
 * The (owner) layout still calls getSession() on the server for fresh
 * data, but the heavy lifting happens here.
 */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify-phone",
  "/forgot-password",
  "/reset-password",
];

function parseSession(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") return NextResponse.next();

  const cookieName = process.env.SESSION_COOKIE_NAME ?? "terminal_session";
  const session = parseSession(req.cookies.get(cookieName)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && !session.user.is_owner && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "owner_required");
    const res = NextResponse.redirect(url);
    res.cookies.delete(cookieName);
    return res;
  }

  if (session && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static assets, the Next.js internals, and Next route handlers.
  // /api/auth/* must remain reachable without a session for login itself.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
