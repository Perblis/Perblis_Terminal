import { NextResponse } from "next/server";

import { clearSession, getSession } from "@/lib/auth/session";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export async function POST() {
  const session = await getSession();

  if (session) {
    await fetch(`${API_BASE_URL}${API_PREFIX}/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access}`,
      },
      body: JSON.stringify({ refresh: session.refresh }),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
