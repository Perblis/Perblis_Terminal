// JWT cookie plumbing (TSD §5): httpOnly + Secure + SameSite=Lax, so browser
// JS never sees a token and cross-site POSTs never carry one. Lifetimes mirror
// simplejwt (access 60 min, refresh 7 days rotating — FSD §4.2).

export const ACCESS_COOKIE = "terminal_access";
export const REFRESH_COOKIE = "terminal_refresh";

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

type CookieOptions = {
  maxAge: number;
  /** Overridable only by tests; defaults to NODE_ENV === "production". */
  secure?: boolean;
};

export function serializeAuthCookie(name: string, value: string, opts: CookieOptions): string {
  const secure = opts.secure ?? process.env.NODE_ENV === "production";
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Set-Cookie headers for a fresh token pair (login or rotated refresh). */
export function tokenCookies(access: string, refresh: string, secure?: boolean): string[] {
  return [
    serializeAuthCookie(ACCESS_COOKIE, access, { maxAge: ACCESS_MAX_AGE, secure }),
    serializeAuthCookie(REFRESH_COOKIE, refresh, { maxAge: REFRESH_MAX_AGE, secure }),
  ];
}

/** Expired Set-Cookie headers that clear the pair (logout / dead session). */
export function clearedTokenCookies(secure?: boolean): string[] {
  return [
    serializeAuthCookie(ACCESS_COOKIE, "", { maxAge: 0, secure }),
    serializeAuthCookie(REFRESH_COOKIE, "", { maxAge: 0, secure }),
  ];
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === name) return decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return null;
}
