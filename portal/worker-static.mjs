export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (url.pathname === "/" || url.pathname === "") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    return assetResponse;
  },
};
