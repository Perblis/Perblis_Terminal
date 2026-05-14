/** RFC 6265 `tchar` — browsers reject Set-Cookie if the name contains e.g. @ ( ) ? = */
const COOKIE_NAME_TCHAR = /^[!#$%&'*+\-.0-9A-Za-z^_`|~]+$/;

export function getSessionCookieName(): string {
  const raw = process.env.SESSION_COOKIE_NAME?.trim();
  if (!raw) return "terminal_session";
  return COOKIE_NAME_TCHAR.test(raw) ? raw : "terminal_session";
}
