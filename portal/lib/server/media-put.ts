// Server-side proxy for presigned R2 PUTs. Browser uploads ride /bff/media-put
// so the portal origin never needs R2 bucket CORS — the Worker forwards bytes to
// the short-lived presigned URL server-side.

const R2_HOST_RE = /\.r2\.cloudflarestorage\.com$/i;

function allowedPublicBaseHost(): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

/** Only forward to Cloudflare R2 presigned URLs — never an open proxy. */
export function isAllowedR2PresignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (R2_HOST_RE.test(parsed.hostname)) return true;
    const publicHost = allowedPublicBaseHost();
    return Boolean(publicHost && parsed.hostname === publicHost);
  } catch {
    return false;
  }
}
