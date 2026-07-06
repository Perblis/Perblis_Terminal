// Authenticated proxy: browser PUT → Worker → R2 presigned URL (avoids bucket CORS).
import { ACCESS_COOKIE, readCookie } from "@/lib/server/cookies";
import { isAllowedR2PresignedUrl } from "@/lib/server/media-put";

export async function PUT(request: Request) {
  if (!readCookie(request, ACCESS_COOKIE)) {
    return Response.json(
      { error: { code: "unauthorized", message: "Sign in to upload media." } },
      { status: 401 },
    );
  }

  const presignedUrl = request.headers.get("x-presigned-url");
  if (!presignedUrl || !isAllowedR2PresignedUrl(presignedUrl)) {
    return Response.json(
      { error: { code: "bad_request", message: "Invalid upload destination." } },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const body = await request.arrayBuffer();
  const upstream = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });

  return new Response(null, { status: upstream.status });
}
