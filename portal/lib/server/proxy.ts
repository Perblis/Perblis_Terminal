// The BFF core (TSD §5): every data request is proxied to DRF with the access
// token from the httpOnly cookie; a 401 triggers ONE refresh (single-flight
// across concurrent requests sharing the refresh token) and one retry. A dead
// refresh yields 401 `session_expired` + cleared cookies — the F12 re-auth
// modal's cue. Pure Request/Response so vitest exercises it without Next.

import { apiBaseUrl } from "./config";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearedTokenCookies, readCookie, tokenCookies } from "./cookies";

type RefreshOutcome = { access: string; refresh: string } | null;

// Keyed by refresh token: one isolate serves many users — a bare module-level
// promise would fuse *different* users' refreshes together.
const refreshesInFlight = new Map<string, Promise<RefreshOutcome>>();

async function doRefresh(refreshToken: string): Promise<RefreshOutcome> {
  const resp = await fetch(`${apiBaseUrl()}/auth/token/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { access?: string; refresh?: string };
  if (!data.access || !data.refresh) return null;
  return { access: data.access, refresh: data.refresh };
}

/** Single-flight: concurrent callers with the same refresh token share one call. */
export function refreshTokens(refreshToken: string): Promise<RefreshOutcome> {
  let inFlight = refreshesInFlight.get(refreshToken);
  if (!inFlight) {
    inFlight = doRefresh(refreshToken).finally(() => refreshesInFlight.delete(refreshToken));
    refreshesInFlight.set(refreshToken, inFlight);
  }
  return inFlight;
}

function sessionExpiredResponse(): Response {
  const response = Response.json(
    { error: { code: "session_expired", message: "Your session has expired. Sign in again." } },
    { status: 401 },
  );
  for (const cookie of clearedTokenCookies()) response.headers.append("set-cookie", cookie);
  return response;
}

async function forward(request: Request, path: string, access: string | null): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers({ accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (access) headers.set("authorization", `Bearer ${access}`);
  return fetch(`${apiBaseUrl()}/${path}${url.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.clone().arrayBuffer(),
  });
}

function passThrough(upstream: Response, extraCookies: string[] = []): Response {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const cookie of extraCookies) headers.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * Proxy an authenticated /bff/* request to DRF, refreshing the token pair
 * once when the access token has gone stale.
 */
export async function proxyWithAuth(request: Request, path: string): Promise<Response> {
  const access = readCookie(request, ACCESS_COOKIE);
  const upstream = await forward(request, path, access);
  if (upstream.status !== 401) return passThrough(upstream);

  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) return sessionExpiredResponse();

  const rotated = await refreshTokens(refreshToken);
  if (!rotated) return sessionExpiredResponse();

  const retried = await forward(request, path, rotated.access);
  return passThrough(retried, tokenCookies(rotated.access, rotated.refresh));
}

/** Public auth endpoints the BFF forwards without a token (F1 flows). */
const PUBLIC_AUTH_PATHS = new Set([
  "register",
  "otp/verify",
  "otp/resend",
  "email/verify",
  "email/resend",
  "password-reset",
  "password-reset/confirm",
]);

/**
 * Handle /auth/<path>. `login` mints the cookie pair, `logout` revokes and
 * clears it, everything on the allowlist proxies through untouched; anything
 * else 404s (the BFF is not an open proxy).
 */
export async function handleAuth(request: Request, path: string): Promise<Response> {
  if (path === "login") {
    const upstream = await forward(request, "auth/login", null);
    if (!upstream.ok) return passThrough(upstream);
    const data = (await upstream.json()) as { access?: string; refresh?: string };
    if (!data.access || !data.refresh) {
      return Response.json(
        { error: { code: "bad_gateway", message: "Sign-in failed upstream. Try again." } },
        { status: 502 },
      );
    }
    const response = Response.json({ ok: true }, { status: 200 });
    for (const cookie of tokenCookies(data.access, data.refresh)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  }

  if (path === "logout") {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    const access = readCookie(request, ACCESS_COOKIE);
    if (refreshToken) {
      // Best-effort blacklist upstream; the cookies clear regardless.
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(access ? { authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({ refresh: refreshToken }),
      }).catch(() => undefined);
    }
    const response = Response.json({ ok: true }, { status: 200 });
    for (const cookie of clearedTokenCookies()) response.headers.append("set-cookie", cookie);
    return response;
  }

  if (PUBLIC_AUTH_PATHS.has(path)) {
    return passThrough(await forward(request, `auth/${path}`, null));
  }

  return Response.json(
    { error: { code: "not_found", message: "Unknown auth endpoint." } },
    { status: 404 },
  );
}
