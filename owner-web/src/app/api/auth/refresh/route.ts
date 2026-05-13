import { NextResponse } from "next/server";

import { clearSession, getSession, setSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: session.refresh }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    await clearSession();
    return NextResponse.json({ error: "refresh failed" }, { status: 401 });
  }

  const data = (await upstream.json()) as {
    access: string;
    refresh?: string;
  };

  await setSession({
    ...session,
    access: data.access,
    // The Django config rotates refresh tokens, so persist the new one if present.
    refresh: data.refresh ?? session.refresh,
  });

  return NextResponse.json({
    ok: true,
    access: data.access,
    refresh: data.refresh ?? session.refresh,
  });
}
