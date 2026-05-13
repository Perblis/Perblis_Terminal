import { NextResponse } from "next/server";

/**
 * Exchanges the httpOnly refresh cookie for a fresh access token.
 * Implemented in Wave 01.
 */
export async function POST() {
  return NextResponse.json({ error: "Not implemented in Wave 00." }, { status: 501 });
}
