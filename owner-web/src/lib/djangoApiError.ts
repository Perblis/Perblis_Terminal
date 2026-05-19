/**
 * Parses Terminal Django JSON error bodies. The API uses a custom wrapper:
 * `{ success: false, errors: { detail?: string, ... }, status_code: N }`.
 */
export function detailFromDjangoErrorJson(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  if (typeof payload === "string") return payload.trim();
  if (typeof payload !== "object") return "";

  const o = payload as Record<string, unknown>;

  const errors = o.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const inner = errors as Record<string, unknown>;
    const d = inner.detail;
    if (typeof d === "string" && d.length) return d.trim();
    if (Array.isArray(d) && typeof d[0] === "string") return d[0].trim();
  }

  const topDetail = o.detail;
  if (typeof topDetail === "string" && topDetail.length) return topDetail.trim();
  if (Array.isArray(topDetail) && typeof topDetail[0] === "string") return topDetail[0].trim();

  return "";
}

const RATE_LIMIT_FALLBACK =
  "Too many sign-in attempts from this device or network. Please wait a few minutes and try again.";

/**
 * User-facing copy for failed owner-web → Django login proxy responses.
 */
export function loginFailureDetail(payload: unknown, httpStatus: number): string {
  const d = detailFromDjangoErrorJson(payload);

  if (httpStatus === 429) {
    return d.length > 0 ? d : RATE_LIMIT_FALLBACK;
  }
  if (httpStatus === 401) {
    return d.length > 0 ? d : "Invalid email or password.";
  }
  return d.length > 0 ? d : "Sign-in failed.";
}
