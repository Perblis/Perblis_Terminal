import { API_BASE_URL, API_PREFIX } from "@/lib/constants";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type TokenStore = {
  access: string | null;
  refresh: string | null;
};

const memoryTokens: TokenStore = { access: null, refresh: null };
let hydrated = false;

function hydrateTokensOnce() {
  if (hydrated || typeof window === "undefined") return;
  memoryTokens.access = localStorage.getItem("tw_access");
  memoryTokens.refresh = localStorage.getItem("tw_refresh");
  hydrated = true;
}

export function setTokens(access: string | null, refresh: string | null) {
  memoryTokens.access = access;
  memoryTokens.refresh = refresh;
  hydrated = true;
  if (typeof window !== "undefined") {
    if (access) localStorage.setItem("tw_access", access);
    else localStorage.removeItem("tw_access");
    if (refresh) localStorage.setItem("tw_refresh", refresh);
    else localStorage.removeItem("tw_refresh");
  }
}

export function loadTokensFromStorage() {
  hydrated = false;
  hydrateTokensOnce();
}

export function getAccessToken() {
  hydrateTokensOnce();
  return memoryTokens.access;
}

async function refreshAccess(): Promise<string | null> {
  if (!memoryTokens.refresh) return null;
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: memoryTokens.refresh }),
  });
  if (!res.ok) {
    setTokens(null, null);
    return null;
  }
  const data = (await res.json()) as { access: string };
  memoryTokens.access = data.access;
  if (typeof window !== "undefined") localStorage.setItem("tw_access", data.access);
  return data.access;
}

type RequestOpts = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  isMultipart?: boolean;
};

function buildUrl(path: string, query?: RequestOpts["query"]) {
  const url = new URL(`${API_BASE_URL}${API_PREFIX}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doFetch(url: string, init: RequestInit, isMultipart: boolean): Promise<Response> {
  hydrateTokensOnce();
  const headers = new Headers(init.headers);
  if (!isMultipart && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (memoryTokens.access) {
    headers.set("Authorization", `Bearer ${memoryTokens.access}`);
  }
  return fetch(url, { ...init, headers });
}

export async function api<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { body, query, isMultipart, ...init } = opts;
  const url = buildUrl(path, query);

  const requestInit: RequestInit = {
    ...init,
    body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
  };

  let res = await doFetch(url, requestInit, !!isMultipart);

  if (res.status === 401 && memoryTokens.refresh) {
    const newAccess = await refreshAccess();
    if (newAccess) {
      res = await doFetch(url, requestInit, !!isMultipart);
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "errors" in payload
        ? JSON.stringify((payload as { errors: unknown }).errors)
        : null) ?? res.statusText;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, opts: RequestOpts = {}) => api<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts: RequestOpts = {}) => {
    const multipart = typeof FormData !== "undefined" && body instanceof FormData;
    return api<T>(path, {
      ...opts,
      method: "PATCH",
      body,
      ...(multipart ? { isMultipart: true } : {}),
    });
  },
  put: <T>(path: string, body?: unknown, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts: RequestOpts = {}) => api<T>(path, { ...opts, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData, opts: RequestOpts = {}) =>
    api<T>(path, {
      ...opts,
      body: formData,
      isMultipart: true,
      method: opts.method ?? "POST",
    }),
};
