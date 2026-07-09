import { API_V1 } from "./api";

const API_ORIGIN = API_V1.replace(/\/api\/v1$/, "");

/**
 * Listing photo URLs are absolute R2 public URLs in prod but RELATIVE
 * dev-proxy paths when R2 isn't configured — resolve against the API origin.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}
