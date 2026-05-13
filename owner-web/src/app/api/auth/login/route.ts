import { NextResponse } from "next/server";

/**
 * httpOnly session cookie login handler. Implemented in Wave 01.
 *
 * Contract (planned):
 *  POST /api/auth/login  { email, password }
 *   → forwards to Django /api/v1/auth/login/
 *   → stores refresh token in an httpOnly cookie (SESSION_COOKIE_NAME)
 *   → returns { access, user } to the client
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented in Wave 00. Use client-side login from Wave 01." },
    { status: 501 },
  );
}
