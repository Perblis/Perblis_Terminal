import { NextResponse } from "next/server";

import { setSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";
import { loginFailureDetail } from "@/lib/djangoApiError";

type LoginRequest = { email?: string; password?: string };

type LoginUpstream = {
  access: string;
  refresh: string;
  // Some deployments embed the user; the canonical Terminal backend does not.
  user?: {
    id: string;
    email: string;
    full_name: string;
    is_owner: boolean;
    is_renter: boolean;
    verification_level: number | string;
  };
};

type MeUpstream = {
  success: true;
  data: {
    id: string;
    email: string;
    full_name: string;
    is_owner: boolean;
    is_renter: boolean;
    verification_level: number | string;
  };
};

/** Forward the browser IP so Django login throttling keys per user, not the Next.js server. */
function upstreamHeadersForThrottle(req: Request): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const xff = req.headers.get("x-forwarded-for")?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (xff) {
    headers.set("X-Forwarded-For", xff);
  } else if (realIp) {
    headers.set("X-Forwarded-For", realIp);
  }
  return headers;
}

export async function POST(req: Request) {
  let body: LoginRequest;
  try {
    body = (await req.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ error: { detail: "Invalid request body." } }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json(
      { error: { detail: "Email and password are required." } },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/login/`, {
    method: "POST",
    headers: upstreamHeadersForThrottle(req),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const raw: unknown = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    if (upstream.status === 404) {
      return NextResponse.json(
        {
          error: {
            detail:
              "Owner web could not reach Django at /api/v1/auth/login/ (404). The browser only calls this Next.js app; the server then calls NEXT_PUBLIC_API_BASE_URL. Set that variable on the Next.js Railway service to your API origin with no trailing slash, then redeploy.",
          },
        },
        { status: 404 },
      );
    }
    const detail = loginFailureDetail(raw, upstream.status);
    return NextResponse.json({ error: { detail } }, { status: upstream.status || 502 });
  }

  const loginData = raw as LoginUpstream | null;
  if (!loginData?.access) {
    const detail = loginFailureDetail(raw, upstream.status);
    return NextResponse.json({ error: { detail } }, { status: 502 });
  }

  // The Terminal backend does not return `user` in the login response, so
  // we resolve the authoritative profile via /users/me/ with the access
  // token. Falling back to whatever shape the upstream sent (if any).
  let user = loginData.user;
  if (!user) {
    const meRes = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${loginData.access}` },
      cache: "no-store",
    });
    if (!meRes.ok) {
      return NextResponse.json(
        {
          error: {
            detail: "Sign-in succeeded but profile lookup failed.",
          },
        },
        { status: 502 },
      );
    }
    const meData = (await meRes.json()) as MeUpstream;
    user = {
      id: meData.data.id,
      email: meData.data.email,
      full_name: meData.data.full_name,
      is_owner: meData.data.is_owner,
      is_renter: meData.data.is_renter,
      verification_level: meData.data.verification_level,
    };
  }

  if (!user.is_owner) {
    return NextResponse.json(
      {
        error: {
          detail: "This account is not enabled as an owner. Enable the owner role and try again.",
        },
      },
      { status: 403 },
    );
  }

  await setSession({
    access: loginData.access,
    refresh: loginData.refresh,
    user,
  });

  return NextResponse.json({
    ok: true,
    user,
    access: loginData.access,
    refresh: loginData.refresh,
  });
}
