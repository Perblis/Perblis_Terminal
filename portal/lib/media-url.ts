/** Object-key prefixes served from the public media bucket (TSD §3.9).
 *  `handovers/` is deliberately absent — handover photos are private-bucket
 *  (D-025) and arrive as presigned `photo_urls`, which must pass through
 *  untouched (rewriting one onto the public proxy would 404 and strip its
 *  signature). */
const PUBLIC_KEY_PREFIXES = ["listings/", "logos/", "avatars/"] as const;

/** Extract an R2 object key from a public media URL returned by the API. */
export function publicMediaKeyFromUrl(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    const key = pathname.replace(/^\//, "");
    if (!key) return null;
    if (hostname.endsWith(".r2.cloudflarestorage.com")) {
      if (PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return key;
      return null;
    }
    if (PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return key;
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve a media URL for browser use (<img src>, etc.).
 * R2 S3 endpoint URLs and API-relative paths ride the BFF — the browser never
 * hits cloudflarestorage.com directly (those URLs are not public-readable).
 */
export function resolveMediaUrl(url: string | null | undefined, r2Key?: string | null): string | null {
  const key = r2Key ?? (url ? publicMediaKeyFromUrl(url) : null);
  if (key) return `/bff/media/public?key=${encodeURIComponent(key)}`;
  if (!url) return null;
  if (url.startsWith("/api/v1/")) return `/bff/${url.slice("/api/v1/".length)}`;
  return url;
}
