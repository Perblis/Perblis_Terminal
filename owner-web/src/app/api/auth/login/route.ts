import { NextResponse } from "next/server";

import { setSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const loginData = (await upstream.json().catch(() => null)) as LoginUpstream | null;

  if (!upstream.ok || !loginData?.access) {
    return NextResponse.json(
      { error: loginData ?? { detail: "Sign-in failed." } },
      { status: upstream.status || 502 },
    );
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
