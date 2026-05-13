import { NextResponse } from "next/server";

/**
 * Clears the httpOnly session cookie and tells Django to blacklist the
 * refresh token. Implemented in Wave 01.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented in Wave 00." }, { status: 501 });
}
