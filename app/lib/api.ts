// Direct-to-DRF API client (no BFF on mobile — TSD §6): JWT pair in
// SecureStore, Bearer attach, single-flight 401 refresh + one retry.
// Mirrors portal/lib/server/proxy.ts semantics client-side.
import * as SecureStore from "expo-secure-store";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api-production-101c8.up.railway.app";

export const API_V1 = `${API_BASE_URL}/api/v1`;

const ACCESS_KEY = "terminal.access";
const REFRESH_KEY = "terminal.refresh";

type ApiErrorBody = {
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

// ---------------------------------------------------------------------------
// Token store: SecureStore-backed with an in-memory cache (no keychain read
// per request).

let accessCache: string | null | undefined; // undefined = not yet loaded
let refreshCache: string | null | undefined;

async function getAccess(): Promise<string | null> {
  if (accessCache === undefined) accessCache = await SecureStore.getItemAsync(ACCESS_KEY);
  return accessCache;
}

async function getRefresh(): Promise<string | null> {
  if (refreshCache === undefined) refreshCache = await SecureStore.getItemAsync(REFRESH_KEY);
  return refreshCache;
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  accessCache = access;
  refreshCache = refresh;
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  accessCache = null;
  refreshCache = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Guest check without a network call (FSD §6 guest posture). */
export async function hasSession(): Promise<boolean> {
  return (await getRefresh()) !== null;
}

// ---------------------------------------------------------------------------
// Session-expired signal → the F12 re-auth sheet (root layout subscribes).

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired(): void {
  for (const l of sessionExpiredListeners) l();
}

// ---------------------------------------------------------------------------
// Single-flight refresh: concurrent 401s share one refresh call. A single
// device serves a single user, so one module-level promise is correct here
// (the portal keys by refresh token because one isolate serves many users).

let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = await getRefresh();
  if (!refresh) return null;
  const resp = await fetch(`${API_V1}/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { access?: string; refresh?: string };
  if (!data.access || !data.refresh) return null;
  await setTokens(data.access, data.refresh);
  return data.access;
}

function refreshAccess(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------

async function parseError(resp: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await resp.json()) as ApiErrorBody;
  } catch {
    // non-JSON error body — keep the fallback message
  }
  return new ApiError(resp.status, body);
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** FormData uploads etc. — body passed through, no JSON headers. */
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Authenticated (or guest) fetch against /api/v1. On 401 with a stored
 * session: ONE single-flight refresh, ONE retry; a dead refresh clears
 * tokens and emits session-expired (F12 re-auth sheet preserving intent).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = `${API_V1}${path}`;

  const doFetch = async (access: string | null): Promise<Response> => {
    const headers: Record<string, string> = { ...options.headers };
    if (access) headers.Authorization = `Bearer ${access}`;
    let body: BodyInit | undefined;
    if (options.rawBody !== undefined) {
      body = options.rawBody;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    return fetch(url, { method: options.method ?? "GET", headers, body, signal: options.signal });
  };

  let resp = await doFetch(await getAccess());

  if (resp.status === 401 && (await getRefresh())) {
    const access = await refreshAccess();
    if (access === null) {
      await clearTokens();
      emitSessionExpired();
    } else {
      resp = await doFetch(access);
      if (resp.status === 401) {
        await clearTokens();
        emitSessionExpired();
      }
    }
  }

  if (!resp.ok) throw await parseError(resp);
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}
