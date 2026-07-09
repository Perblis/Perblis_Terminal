// Wave-8 mandatory: the api client's 401 discipline — concurrent 401s share
// ONE refresh (single-flight), retry once, and a dead refresh clears tokens
// + emits session-expired (F12).
import { ApiError, apiFetch, clearTokens, onSessionExpired, setTokens } from "./api";

// SecureStore is mocked in-memory (test/jest-setup.ts).

type FetchCall = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let calls: FetchCall[] = [];

function mockFetchSequence(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  calls = [];
  let n = 0;
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    n += 1;
    return handler(call.url, call.init, n);
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await clearTokens();
});

test("attaches Bearer when a session exists, none for guests", async () => {
  mockFetchSequence(() => jsonResponse(200, { ok: true }));
  await apiFetch("/search/map");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();

  await setTokens("acc-1", "ref-1");
  await apiFetch("/hires");
  expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer acc-1");
});

test("401 → single refresh → retry once with the new access token", async () => {
  await setTokens("stale", "ref-1");
  mockFetchSequence((url, init) => {
    if (url.endsWith("/auth/token/refresh")) {
      return jsonResponse(200, { access: "fresh", refresh: "ref-2" });
    }
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth === "Bearer fresh" ? jsonResponse(200, { id: 1 }) : jsonResponse(401, {});
  });

  const result = await apiFetch<{ id: number }>("/hires/x");
  expect(result).toEqual({ id: 1 });
  const refreshCalls = calls.filter((c) => c.url.endsWith("/auth/token/refresh"));
  expect(refreshCalls).toHaveLength(1);
});

test("concurrent 401s share ONE refresh call (single-flight)", async () => {
  await setTokens("stale", "ref-1");
  mockFetchSequence(async (url, init) => {
    if (url.endsWith("/auth/token/refresh")) {
      await new Promise((r) => setTimeout(r, 20)); // let both 401s land first
      return jsonResponse(200, { access: "fresh", refresh: "ref-2" });
    }
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth === "Bearer fresh" ? jsonResponse(200, {}) : jsonResponse(401, {});
  });

  await Promise.all([apiFetch("/hires"), apiFetch("/conversations"), apiFetch("/me")]);
  const refreshCalls = calls.filter((c) => c.url.endsWith("/auth/token/refresh"));
  expect(refreshCalls).toHaveLength(1);
});

test("dead refresh clears tokens and emits session-expired", async () => {
  await setTokens("stale", "ref-dead");
  let expired = 0;
  const off = onSessionExpired(() => {
    expired += 1;
  });
  mockFetchSequence((url) => {
    if (url.endsWith("/auth/token/refresh")) return jsonResponse(401, {});
    return jsonResponse(401, { error: { code: "token_not_valid" } });
  });

  await expect(apiFetch("/hires")).rejects.toBeInstanceOf(ApiError);
  expect(expired).toBe(1);

  // Tokens gone: the next call goes out as a guest and does NOT re-refresh.
  mockFetchSequence(() => jsonResponse(200, { ok: true }));
  await apiFetch("/search/map");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
  off();
});

test("DRF error envelope surfaces as ApiError with code + fields", async () => {
  mockFetchSequence(() =>
    jsonResponse(409, {
      error: {
        code: "availability_conflict",
        message: "Those dates were just taken.",
        fields: { start_date: ["Overlaps a confirmed hire."] },
      },
    }),
  );
  const err = await apiFetch("/hires").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  const apiErr = err as ApiError;
  expect(apiErr.status).toBe(409);
  expect(apiErr.code).toBe("availability_conflict");
  expect(apiErr.fields?.start_date).toBeDefined();
});
