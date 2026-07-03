import { NextResponse, type NextRequest } from "next/server";

// P12 maintenance flag: MAINTENANCE=1 rewrites every page to /maintenance.
// BFF/auth routes stay up so ops tooling can still probe; flip the env var
// off and traffic resumes without a deploy.
export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE === "1" && request.nextUrl.pathname !== "/maintenance") {
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only — skip BFF/auth handlers, static assets, and internals.
  matcher: ["/((?!auth/|bff/|_next/|favicon.ico|.*\\..*).*)"],
};
