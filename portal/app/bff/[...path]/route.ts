// /bff/* — the only data path between the browser and DRF (TSD §5). Adds the
// Bearer token server-side; browser JS never sees it.
import { proxyWithAuth } from "@/lib/server/proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyWithAuth(request, path.join("/"));
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
