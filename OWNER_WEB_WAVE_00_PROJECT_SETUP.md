# TERMINAL OWNER WEB — WAVE 00: PROJECT SETUP
> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 01 until the Definition of Done checklist is fully complete.

---

## Context

You are building **Terminal Owner Web** — a Next.js 15 (App Router) web app for asset owners on the Terminal platform. Owners use this app to manage fleet listings, accept bookings, message renters, view analytics, and configure payouts. The backend API already exists (Django REST at `{API_BASE_URL}/api/v1/`) and is the same backend the mobile renter app consumes.

**What Terminal is:** An industrial marketplace connecting owners of heavy equipment (cranes, excavators), vehicles (flatbed trucks, tippers), warehouses, container terminals, and facilities with renters across Nigeria. Owners are typically managing fleet from a laptop in a yard office — this app is **web-first responsive**, optimized for desktop, degrading to tablet/mobile.

**Design system:** Terminal Design System (TDS) v1.1 — Forge Dark — defined at `https://github.com/Nwabukin/Terminal-Design`. All visual decisions come from that system. Read its `README.md` and `SKILL.md` before writing any UI code.

**Non-negotiables (from TDS SKILL.md):**
- Forge dark only. Background `#0C0C0F`. No light mode. No gradients. No glassmorphism.
- One accent per screen — Forge Orange `#E8750A` only on the single primary action, the selected item, the active nav.
- Borders, not shadows. Elevation = lighter surface + 1 px border. Status emphasis = 3 px **left** border on a card.
- Categories encoded by **icon**, not color. All five resource types share neutral surfaces.
- Display type is Barlow Condensed 700, uppercase, always. Body is IBM Plex Sans, sentence case. Numeric data is IBM Plex Mono.
- Max 4 type sizes per screen.
- 4 px spacing scale: `4 8 12 16 20 24 32 40 48 64 80 96`. No 14, 18, 28.
- Currency `₦45,000` — no decimal, no space. Date ranges `May 10 – May 13` — en dash.
- Voice is dispatch, not customer service. No emoji, no exclamations, no "we".

This wave sets up the entire project skeleton. All subsequent waves build on top of it.

---

## Step 1: Create the Next.js project

From the repository root (`/home/user/terminalv2`):

```bash
npx create-next-app@latest owner-web \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --turbopack
cd owner-web
```

When prompted for any additional options, accept defaults. The `--no-eslint` flag avoids the Next 15 ESLint v9 prompt; we add it manually below.

---

## Step 2: Install dependencies

```bash
# Data fetching, types, schema
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install -D openapi-typescript

# Forms & validation
npm install react-hook-form zod @hookform/resolvers

# Realtime messaging
npm install ably

# Maps (used in listing editor)
npm install mapbox-gl
npm install -D @types/mapbox-gl

# UI primitives (shadcn deps — we install Radix directly so we control versions)
npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-popover \
  @radix-ui/react-select \
  @radix-ui/react-toast \
  @radix-ui/react-tooltip \
  @radix-ui/react-tabs \
  @radix-ui/react-checkbox \
  @radix-ui/react-switch \
  @radix-ui/react-label \
  @radix-ui/react-slot \
  @radix-ui/react-avatar \
  @radix-ui/react-separator \
  @radix-ui/react-progress
npm install class-variance-authority clsx tailwind-merge lucide-react

# Charts (analytics waves)
npm install recharts

# Date helpers
npm install date-fns

# Cookies for httpOnly auth on server actions
npm install cookies-next

# Linting / formatting
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss

# Fonts (self-hosted)
npm install @fontsource/barlow-condensed @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```

---

## Step 3: Create the directory structure

Create the following structure under `owner-web/`. Create every directory and an empty placeholder file (`.gitkeep` is fine for now where noted).

```
owner-web/
├── .env.local                        # Local dev env (gitignored)
├── .env.example                      # Committed template
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── README.md
├── scripts/
│   └── generate-api-types.sh         # Pulls /api/schema/ and runs openapi-typescript
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout — fonts, providers, body class
    │   ├── globals.css               # Tailwind + TDS tokens (from colors_and_type.css)
    │   ├── page.tsx                  # Marketing-free redirect → /dashboard or /login
    │   ├── (auth)/                   # Unauthenticated routes
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   ├── verify-phone/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── reset-password/page.tsx
    │   ├── (owner)/                  # Authenticated owner routes (added in later waves)
    │   │   ├── layout.tsx
    │   │   ├── dashboard/page.tsx
    │   │   ├── listings/
    │   │   ├── bookings/
    │   │   ├── messages/
    │   │   ├── analytics/
    │   │   └── settings/
    │   └── api/
    │       └── auth/                 # Route handlers for httpOnly cookie auth
    │           ├── login/route.ts
    │           ├── logout/route.ts
    │           └── refresh/route.ts
    ├── components/
    │   ├── ui/                       # Re-skinned primitives (Button, Input, Dialog, …)
    │   │   └── .gitkeep
    │   ├── tds/                      # Bespoke TDS components ported from the UI kit
    │   │   ├── KpiCard.tsx           # (later wave)
    │   │   ├── ListingCard.tsx       # (later wave)
    │   │   ├── BookingRow.tsx        # (later wave)
    │   │   ├── StatusDot.tsx
    │   │   ├── ResourceIcon.tsx
    │   │   └── .gitkeep
    │   ├── layout/
    │   │   ├── Sidebar.tsx           # (later wave)
    │   │   ├── TopBar.tsx            # (later wave)
    │   │   └── .gitkeep
    │   └── providers/
    │       └── QueryProvider.tsx
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts             # Typed fetch wrapper with JWT refresh
    │   │   ├── types.gen.ts          # Generated from /api/schema/ (Step 8)
    │   │   ├── auth.ts               # (later wave)
    │   │   ├── owner.ts              # (later wave)
    │   │   ├── listings.ts           # (later wave)
    │   │   ├── bookings.ts           # (later wave)
    │   │   ├── messaging.ts          # (later wave)
    │   │   └── users.ts              # (later wave)
    │   ├── auth/
    │   │   ├── session.ts            # Server-side session helpers (cookies)
    │   │   └── guards.ts             # Route guards / redirects
    │   ├── format.ts                 # Currency (₦), distance, dates
    │   ├── cn.ts                     # className merge helper
    │   └── constants.ts              # Resource types, statuses, query keys
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useAbly.ts                # (later wave)
    │   └── .gitkeep
    └── styles/
        └── tokens.css                # Verbatim copy of colors_and_type.css
```

---

## Step 4: Wire up design tokens

**File: `src/styles/tokens.css`**

Copy the full contents of `colors_and_type.css` from `https://github.com/Nwabukin/Terminal-Design/blob/main/colors_and_type.css` into this file verbatim. Replace the four `@import` font URLs at the top with the equivalent local `@fontsource` imports — these are loaded by `src/app/layout.tsx` via `import '@fontsource/...'` instead, so delete the `@import url(...)` lines but keep everything from `:root { ... }` onward.

**File: `src/app/globals.css`**

```css
@import "tailwindcss";
@import "../styles/tokens.css";

@layer base {
  html, body {
    background: var(--bg-app);
    color: var(--text-primary);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  body {
    min-height: 100vh;
  }

  ::selection {
    background: var(--forge-dim);
    color: var(--text-primary);
  }

  /* Forge dark scrollbars */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: var(--abyss); }
  ::-webkit-scrollbar-thumb { background: var(--surface-high); border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-active); }
}

@layer utilities {
  .tds-no-scrollbar::-webkit-scrollbar { display: none; }
  .tds-no-scrollbar { scrollbar-width: none; }
}
```

**File: `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const tdsSpacing = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    spacing: tdsSpacing,
    borderRadius: {
      none: "0",
      DEFAULT: "4px",
      sm: "4px",
      card: "8px",
      sheet: "12px",
      pill: "9999px",
      full: "9999px",
    },
    extend: {
      colors: {
        abyss: "var(--abyss)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-high": "var(--surface-high)",
        border: "var(--border)",
        "border-active": "var(--border-active)",

        forge: "var(--forge)",
        "forge-light": "var(--forge-light)",
        "forge-mid": "var(--forge-mid)",
        "forge-dim": "var(--forge-dim)",
        amber: "var(--amber)",
        "amber-dim": "var(--amber-dim)",

        clear: "var(--clear)",
        "clear-soft": "var(--clear-soft)",
        "clear-dim": "var(--clear-dim)",
        signal: "var(--signal)",
        "signal-soft": "var(--signal-soft)",
        "signal-dim": "var(--signal-dim)",
        alert: "var(--alert)",
        "alert-soft": "var(--alert-soft)",
        "alert-dim": "var(--alert-dim)",

        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-on-accent": "var(--text-on-accent)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        decelerate: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast: "80ms",
        DEFAULT: "200ms",
        sheet: "280ms",
      },
    },
  },
  plugins: [],
};

export default config;
```

> The spacing scale **replaces** Tailwind's default — TDS forbids 14/18/28 etc. Use `p-3`, `m-5`, `gap-4` etc. that map to `12px`, `20px`, `16px`. If you find yourself needing `p-3.5`, stop — the design is wrong, not the scale.

---

## Step 5: Load fonts in the root layout

**File: `src/app/layout.tsx`**

```typescript
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";

import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Terminal — Owner",
  description: "Manage your fleet on Terminal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

**File: `src/components/providers/QueryProvider.tsx`**

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

---

## Step 6: Environment variables

**File: `.env.example`**

```
# Public — sent to the browser
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=

# Server-only
SESSION_COOKIE_NAME=terminal_session
SESSION_COOKIE_SECURE=false   # true in production (HTTPS only)
```

**File: `.env.local`** (gitignored)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=
SESSION_COOKIE_NAME=terminal_session
SESSION_COOKIE_SECURE=false
```

Add `.env.local` to `.gitignore` (Next.js does this by default — verify).

---

## Step 7: Constants and formatters

**File: `src/lib/constants.ts`**

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const API_PREFIX = "/api/v1";

export const RESOURCE_TYPES = [
  "equipment",
  "vehicle",
  "warehouse",
  "terminal",
  "facility",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const LISTING_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "declined",
  "active",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const QUERY_KEYS = {
  me: ["me"] as const,
  dashboard: ["owner", "dashboard"] as const,
  businessProfile: ["owner", "business-profile"] as const,
  bankAccount: ["owner", "bank-account"] as const,
  notifications: ["owner", "notifications"] as const,
  listings: (filters?: Record<string, unknown>) =>
    ["listings", filters ?? {}] as const,
  listing: (id: string) => ["listing", id] as const,
  listingStats: (id: string) => ["listing", id, "stats"] as const,
  bookings: (filters?: Record<string, unknown>) =>
    ["bookings", filters ?? {}] as const,
  booking: (id: string) => ["booking", id] as const,
  calendar: (start: string, end: string) =>
    ["owner", "calendar", start, end] as const,
  threads: ["threads"] as const,
  thread: (id: string) => ["thread", id] as const,
  revenue: (period: string, year?: number, month?: number) =>
    ["owner", "analytics", "revenue", period, year, month] as const,
  performance: (period: string) =>
    ["owner", "analytics", "performance", period] as const,
};
```

**File: `src/lib/format.ts`**

```typescript
const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return ngn.format(n);
}

export function formatDateRange(start: string, end: string): string {
  // en dash, no year if same year as today
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const today = new Date().getFullYear();
  const yearSuffix = sameYear && s.getFullYear() === today ? "" : `, ${s.getFullYear()}`;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-NG", opts)} – ${e.toLocaleDateString("en-NG", opts)}${yearSuffix}`;
}

export function formatDistanceKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
```

**File: `src/lib/cn.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Step 8: Generate API types from `/api/schema/`

**File: `scripts/generate-api-types.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}"
echo "Pulling OpenAPI schema from ${BASE}/api/schema/"

npx openapi-typescript "${BASE}/api/schema/?format=json" \
  --output src/lib/api/types.gen.ts

echo "✓ src/lib/api/types.gen.ts updated."
```

Make it executable:

```bash
chmod +x scripts/generate-api-types.sh
```

Add to `package.json` scripts:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "gen:api": "./scripts/generate-api-types.sh"
}
```

**Run it now** (the backend must be running on `localhost:8000`):

```bash
npm run gen:api
```

If the backend is not running, create a placeholder `src/lib/api/types.gen.ts` with `export type placeholder = unknown;` and regenerate as soon as the backend is reachable. **Do not proceed past Wave 01 without real generated types.**

---

## Step 9: Typed API client with JWT refresh

**File: `src/lib/api/client.ts`**

```typescript
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

export function setTokens(access: string | null, refresh: string | null) {
  memoryTokens.access = access;
  memoryTokens.refresh = refresh;
  if (typeof window !== "undefined") {
    if (access) localStorage.setItem("tw_access", access);
    else localStorage.removeItem("tw_access");
    if (refresh) localStorage.setItem("tw_refresh", refresh);
    else localStorage.removeItem("tw_refresh");
  }
}

export function loadTokensFromStorage() {
  if (typeof window === "undefined") return;
  memoryTokens.access = localStorage.getItem("tw_access");
  memoryTokens.refresh = localStorage.getItem("tw_refresh");
}

export function getAccessToken() {
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

async function doFetch(url: string, init: RequestInit, isMultipart: boolean) {
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
    body: body === undefined
      ? undefined
      : isMultipart
        ? (body as FormData)
        : JSON.stringify(body),
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
  const payload = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

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
  get: <T>(path: string, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData, opts: RequestOpts = {}) =>
    api<T>(path, { ...opts, method: "POST", body: formData, isMultipart: true }),
};
```

> Token storage uses `localStorage` for simplicity in Wave 00. Wave 01 hardens this with httpOnly cookies via Next.js route handlers so refresh tokens never touch the browser. **Do not ship to production with localStorage tokens.**

---

## Step 10: Landing page redirect

**File: `src/app/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const c = await cookies();
  const session = c.get(process.env.SESSION_COOKIE_NAME ?? "terminal_session");
  if (session?.value) redirect("/dashboard");
  redirect("/login");
}
```

**File: `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center bg-abyss px-5 py-12">
      <div className="w-full max-w-[400px]">{children}</div>
    </main>
  );
}
```

**File: `src/app/(auth)/login/page.tsx`** (placeholder — built out in Wave 01)

```typescript
export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="font-display uppercase text-[36px] leading-none tracking-tight">
        Terminal
      </div>
      <p className="text-text-secondary">Owner sign-in coming in Wave 01.</p>
    </div>
  );
}
```

---

## Step 11: Verify the setup runs

```bash
npm run typecheck
npm run dev
```

Open `http://localhost:3000/`:

- It must redirect to `/login`
- The `/login` page must render on a `#0C0C0F` background
- The word "Terminal" must render in Barlow Condensed 700, uppercase
- Browser console must have **zero errors**

Stop the dev server with `Ctrl+C` before continuing.

---

## Step 12: Lint & format setup

**File: `.eslintrc.json`** (owner-web/)

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

**File: `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Add to `package.json` scripts:

```json
"format": "prettier --write \"src/**/*.{ts,tsx,css}\""
```

Run once:

```bash
npm run format
npm run typecheck
```

Both must pass cleanly.

---

## Step 13: Commit

From the repository root:

```bash
git add owner-web/ .gitignore
git commit -m "owner-web: project setup — Wave 00"
```

---

## Definition of Done

Verify every item before handing back to supervisor.

- [ ] `owner-web/` exists at the repository root, scaffolded by `create-next-app` with TS + Tailwind + App Router
- [ ] `npm run dev` boots `http://localhost:3000/` with no console errors
- [ ] `/` redirects to `/login`
- [ ] `/login` renders on `#0C0C0F` with Barlow Condensed uppercase wordmark
- [ ] `src/styles/tokens.css` contains the full TDS token set (verbatim from Terminal-Design)
- [ ] `tailwind.config.ts` exposes TDS colors, the restricted spacing scale, TDS radii, and `font-display`/`font-body`/`font-mono`
- [ ] `src/app/layout.tsx` loads all four `@fontsource` packages
- [ ] `src/lib/api/client.ts` exports `apiClient` with `get/post/patch/put/delete/upload` and JWT refresh on 401
- [ ] `src/lib/constants.ts` exports `API_BASE_URL`, `RESOURCE_TYPES`, `LISTING_STATUSES`, `BOOKING_STATUSES`, `QUERY_KEYS`
- [ ] `src/lib/format.ts` exports `formatNaira` (₦ comma, no decimals), `formatDateRange` (en dash), `formatRelativeTime`
- [ ] `npm run gen:api` runs successfully against a live backend and produces `src/lib/api/types.gen.ts` (or a placeholder noted in the commit)
- [ ] `npm run typecheck` and `npm run format` both pass
- [ ] `.env.local` exists locally and is gitignored; `.env.example` is committed
- [ ] Git commit `owner-web: project setup — Wave 00` is made
