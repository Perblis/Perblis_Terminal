// Browser-side API client. Everything goes through the BFF on this origin;
// errors surface as ApiError carrying the backend's stable error codes.

export type ApiErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? "Something went wrong. Try again.");
    this.status = status;
    this.code = body.error?.code ?? "unknown";
    this.fields = body.error?.fields;
  }
}

export const SESSION_EXPIRED_EVENT = "terminal:session-expired";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only claim JSON for string bodies — FormData must set its own multipart
  // boundary (verification uploads ride this path through the BFF).
  const jsonHeaders =
    init?.body === undefined || typeof init.body === "string"
      ? { "content-type": "application/json" }
      : undefined;
  const resp = await fetch(path, {
    ...init,
    headers: { ...jsonHeaders, ...init?.headers },
  });
  if (resp.ok) {
    return resp.status === 204 ? (undefined as T) : ((await resp.json()) as T);
  }
  let body: ApiErrorBody = {};
  try {
    body = (await resp.json()) as ApiErrorBody;
  } catch {
    // non-JSON upstream failure; the generic message stands
  }
  const error = new ApiError(resp.status, body);
  if (error.code === "session_expired" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  throw error;
}

/** Authenticated data calls — GET/POST/PATCH/DELETE via /bff/*. */
export function bff<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(`/bff${path}`, init);
}

/** Credential calls — /auth/* (login, register, OTP, resets, logout). */
export function auth<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(`/auth${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Resolve a media URL from the API for browser use. R2 URLs are absolute and
 * pass through; local-dev fallback URLs are relative to the API origin
 * ("/api/v1/media/...") and must ride the BFF instead.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/api/v1/")) return `/bff/${url.slice("/api/v1/".length)}`;
  return url;
}
