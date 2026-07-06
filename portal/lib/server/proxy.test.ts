// Mandatory Wave 7 tests (wave-7.md §Mandatory): BFF 401 single-flight refresh
// and cookie security flags. The proxy is pure Request/Response, so we stub
// global fetch and drive it directly.
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleAuth, proxyWithAuth } from "./proxy";

const API = "http://localhost:8000/api/v1";

type Call = { url: string; init?: RequestInit };

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
  return calls;
}

function bffRequest(path: string, cookies: string) {
  return new Request(`https://portal.test/bff/${path}`, {
    headers: { cookie: cookies },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxyWithAuth single-flight refresh", () => {
  it("two parallel 401s share exactly one refresh call, then both retry", async () => {
    let refreshCalls = 0;
    stubFetch(async (url, init) => {
      if (url === `${API}/auth/token/refresh`) {
        refreshCalls += 1;
        // Hold the refresh open long enough for both 401s to queue behind it.
        await new Promise((r) => setTimeout(r, 20));
        return Response.json({ access: "new-access", refresh: "new-refresh" });
      }
      const bearer = new Headers(init?.headers).get("authorization");
      if (bearer === "Bearer new-access") return Response.json({ ok: true });
      return Response.json({ error: { code: "token_not_valid" } }, { status: 401 });
    });

    const cookies = "terminal_access=stale; terminal_refresh=live-refresh";
    const [a, b] = await Promise.all([
      proxyWithAuth(bffRequest("hires/stats", cookies), "hires/stats"),
      proxyWithAuth(bffRequest("me", cookies), "me"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Both responses rotate the cookie pair to the refreshed tokens.
    for (const resp of [a, b]) {
      const setCookies = resp.headers.getSetCookie();
      expect(setCookies.some((c) => c.startsWith("terminal_access=new-access"))).toBe(true);
      expect(setCookies.some((c) => c.startsWith("terminal_refresh=new-refresh"))).toBe(true);
    }
  });

  it("dead refresh returns 401 session_expired and clears both cookies", async () => {
    stubFetch((url) => {
      if (url === `${API}/auth/token/refresh`) {
        return Response.json({ error: { code: "token_not_valid" } }, { status: 401 });
      }
      return Response.json({ error: { code: "token_not_valid" } }, { status: 401 });
    });

    const resp = await proxyWithAuth(
      bffRequest("me", "terminal_access=stale; terminal_refresh=dead"),
      "me",
    );
    expect(resp.status).toBe(401);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe("session_expired");
    const setCookies = resp.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith("terminal_access=;") && c.includes("Max-Age=0"))).toBe(true);
    expect(setCookies.some((c) => c.startsWith("terminal_refresh=;") && c.includes("Max-Age=0"))).toBe(true);
  });

  it("missing refresh cookie short-circuits to session_expired without an upstream refresh", async () => {
    const calls = stubFetch(() =>
      Response.json({ error: { code: "token_not_valid" } }, { status: 401 }),
    );
    const resp = await proxyWithAuth(bffRequest("me", "terminal_access=stale"), "me");
    expect(resp.status).toBe(401);
    expect(calls.some((c) => c.url.includes("token/refresh"))).toBe(false);
  });
});

describe("handleAuth login cookies", () => {
  function loginRequest() {
    return new Request("https://portal.test/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "s@example.com", password: "pw" }),
    });
  }

  it("sets httpOnly SameSite=Lax cookies for the token pair (Secure in prod)", async () => {
    stubFetch(() => Response.json({ access: "acc-1", refresh: "ref-1" }));
    vi.stubEnv("NODE_ENV", "production");

    const resp = await handleAuth(loginRequest(), "login");
    expect(resp.status).toBe(200);
    const setCookies = resp.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    for (const cookie of setCookies) {
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("Path=/");
    }
    expect(setCookies.find((c) => c.startsWith("terminal_access="))).toContain("Max-Age=3600");
    expect(setCookies.find((c) => c.startsWith("terminal_refresh="))).toContain("Max-Age=604800");
  });

  it("passes DRF login errors through without setting cookies", async () => {
    stubFetch(() =>
      Response.json(
        { error: { code: "phone_not_verified", message: "Verify your phone first." } },
        { status: 403 },
      ),
    );
    const resp = await handleAuth(loginRequest(), "login");
    expect(resp.status).toBe(403);
    expect(resp.headers.getSetCookie()).toHaveLength(0);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe("phone_not_verified");
  });

  it("rejects unknown auth paths with 404 (not an open proxy)", async () => {
    const calls = stubFetch(() => Response.json({}));
    const resp = await handleAuth(
      new Request("https://portal.test/auth/me", { method: "POST" }),
      "me",
    );
    expect(resp.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});
