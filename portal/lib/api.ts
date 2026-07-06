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
export { resolveMediaUrl as mediaUrl } from "./media-url";

const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedPhotoType(type: string): boolean {
  return PHOTO_CONTENT_TYPES.has(type);
}

function isExternalPresignedUrl(url: string): boolean {
  return url.startsWith("https://") && !url.startsWith("/");
}

/**
 * PUT bytes to a presigned upload URL. Local-dev API paths ride the BFF;
 * R2 presigned URLs ride /bff/media-put so the browser never needs bucket CORS.
 */
export function putPresignedUpload(
  presignedUrl: string,
  body: Blob,
  contentType: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const local = presignedUrl.startsWith("/api/v1/")
    ? `/bff/${presignedUrl.slice("/api/v1/".length)}`
    : null;
  const proxied = !local && isExternalPresignedUrl(presignedUrl);
  const putUrl = local ?? (proxied ? "/bff/media-put" : presignedUrl);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", putUrl);
    xhr.setRequestHeader("content-type", contentType);
    if (proxied) xhr.setRequestHeader("x-presigned-url", presignedUrl);
    if (onProgress) {
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.send(body);
  });
}
