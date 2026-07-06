// /auth/* — the BFF's credential endpoints (TSD §5). POST-only by design:
// every auth interaction mutates state (tokens, OTPs, resets).
import { handleAuth } from "@/lib/server/proxy";

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return handleAuth(request, path.join("/"));
}
