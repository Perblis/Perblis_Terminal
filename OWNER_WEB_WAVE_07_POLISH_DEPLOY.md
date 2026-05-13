# TERMINAL OWNER WEB — WAVE 07: POLISH + DEPLOY

> Agent task file. Execute every instruction in order. Do not skip steps.
> Mark every Definition of Done item before declaring v1 shipped.

---

## Context

Every screen exists and is wired to the API. This wave makes the app **production-ready**:

1. **Empty / loading / error states** — audit every screen for the three states and tighten the copy to TDS dispatch voice.
2. **Accessibility** — keyboard navigation, focus rings, `aria-*` on interactive icons, color contrast on the dark theme.
3. **Performance** — code-split heavy routes, skeleton coverage, image optimization, font subsetting.
4. **Error handling** — global toast surface, error boundary, retry primitives.
5. **Observability** — Sentry browser SDK with the same DSN env as the backend.
6. **E2E smoke tests** — Playwright covering: login, create listing, upload photo, activate, view dashboard, accept a booking, send a message, change a setting.
7. **Deploy** — Railway (or Vercel) configuration that points at the production API.

---

## Step 1: Global toast surface

**File: `src/components/ui/Toaster.tsx`**

```typescript
"use client";

import * as Toast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
};

type Ctx = { push: (t: Omit<ToastItem, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      <ToastCtx.Provider value={{ push }}>{children}</ToastCtx.Provider>
      {items.map((t) => (
        <Toast.Root
          key={t.id}
          onOpenChange={(open) =>
            !open && setItems((prev) => prev.filter((x) => x.id !== t.id))
          }
          className={cn(
            "rounded-card border p-3 bg-surface-elevated grid gap-1 grid-cols-[1fr_auto] items-start",
            t.tone === "success" && "border-l-[3px] border-l-clear",
            t.tone === "danger" && "border-l-[3px] border-l-alert",
            (!t.tone || t.tone === "neutral") && "border-border",
          )}
        >
          <div>
            <Toast.Title className="text-[14px] font-medium">{t.title}</Toast.Title>
            {t.description ? (
              <Toast.Description className="text-[12px] text-text-secondary">
                {t.description}
              </Toast.Description>
            ) : null}
          </div>
          <Toast.Close className="text-text-tertiary hover:text-text-primary">
            <X size={14} strokeWidth={1.5} />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2.5rem)] outline-none" />
    </Toast.Provider>
  );
}
```

Wire it into `src/app/layout.tsx`:

```typescript
import { ToasterProvider } from "@/components/ui/Toaster";

// inside <body>
<QueryProvider>
  <ToasterProvider>{children}</ToasterProvider>
</QueryProvider>;
```

Use `useToast()` from key mutations:

- Listing bulk action → "Activated 3 listings." / "Skipped 2 — missing photo."
- Booking accept / decline / cancel / pay → "Booking confirmed for May 10 – 13." (en dash via `formatDateRange`)
- Settings save → "Saved." (terse, no exclamation)
- Auth errors → toast in danger tone

---

## Step 2: Error boundary

**File: `src/app/(owner)/error.tsx`** (Next.js segment-level error boundary)

```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry captures via the Sentry SDK init (Step 5). This is a fallback log.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="max-w-[440px] text-center space-y-3">
        <div className="font-display uppercase text-[36px]">Something broke.</div>
        <p className="text-text-secondary">Tap to retry. If it keeps failing, sign out and back in.</p>
        <div className="flex justify-center">
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
```

**File: `src/app/(owner)/not-found.tsx`**

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="max-w-[440px] text-center space-y-3">
        <div className="font-display uppercase text-[36px]">Not found.</div>
        <p className="text-text-secondary">The page or record doesn't exist.</p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 3: Empty / loading / error audit

For every page below, verify each of the three states. Tighten copy to dispatch voice. The reference messages are mandatory copy:

| Page | Empty | Loading | Error |
|---|---|---|---|
| Dashboard | n/a (always has stats) | Full skeleton | "Couldn't load dashboard. Tap to retry." |
| Listings index | "No listings yet." + CTA `New listing` | 6-card grid skeleton | "Couldn't load listings. Tap to retry." |
| Listing detail | n/a | Full skeleton | "Listing not found." (404 not-found page) |
| Listing editor | hint about activation rules when blocked | Skeleton | inline error under each field |
| Bookings inbox (pending) | "No requests waiting." | 5-row skeleton | toast in danger tone |
| Bookings inbox (other tabs) | "Nothing here." | same | same |
| Booking detail | n/a | Skeleton | "Booking not found." |
| Calendar | "No bookings this month." | timeline skeleton (one row of skeleton bars) | toast |
| Messages list | "No conversations yet." | 6-row skeleton | toast |
| Thread | "No messages yet. Start the conversation." | Skeleton | toast |
| Analytics — Revenue | "No bookings in this period." | chart + KPI skeleton | toast |
| Analytics — Performance | "No data in this period." | same | toast |
| Settings — Profile | n/a | Card skeleton | inline error under form |
| Settings — Bank | hint about validation | same | inline |
| Settings — Notifications | n/a | same | toast |
| Settings — Account | n/a | KYC card skeleton | inline + toast |

Every empty state with an action must use `EmptyState` with a `cta`. Every error state with a retry must surface a `Retry` button.

---

## Step 4: Accessibility pass

Run through every screen with the keyboard only:

- **Tab order** must follow visual order on every page.
- **Focus rings** must be visible on every focusable element — the `Button` primitive already includes `focus-visible:ring-2 focus-visible:ring-forge`; verify Inputs, Tabs, Dialogs, Dropdown items inherit the same treatment.
- **All icon-only buttons** must have an `aria-label` (logout, notifications bell, delete photo, calendar nav arrows).
- **Form fields** must reference labels via `htmlFor` / `id` (the `Field` component handles this; verify all callers pass `id`).
- **Radix Dialog** must trap focus and restore it to the trigger on close — Radix does this by default. Verify the booking decline / cancel dialogs.
- **Color contrast**: run the deployed dark theme through Axe — the only known low-contrast pair is `text-tertiary (#52526A)` on `surface (#131318)` (4.3:1, borderline AA Large). Reserve `text-tertiary` for **meta text only**, never for primary labels or interactive elements. Confirm via grep:

```bash
rg "text-text-tertiary" src/ | rg -v "(font-mono|caption|uppercase|tracking|chip|timestamp|hint|relative|meta)"
```

Any match outside meta usage is a violation — change it to `text-text-secondary`.

---

## Step 5: Sentry browser

```bash
npm install @sentry/nextjs
```

Run the Sentry wizard (or copy the standard config):

```bash
npx @sentry/wizard@latest -i nextjs --saas --org <org> --project owner-web
```

Read the generated `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`. Verify they call `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ... })`. Add to `.env.example`:

```
NEXT_PUBLIC_SENTRY_DSN=
```

In `src/lib/api/client.ts`, capture non-401 5xx errors with Sentry:

```typescript
import * as Sentry from "@sentry/nextjs";
// inside the ApiError throw branch:
if (res.status >= 500) {
  Sentry.captureException(new ApiError(res.status, message, payload), {
    tags: { path },
  });
}
```

---

## Step 6: Performance

1. **Route-level lazy chunks**: Next.js App Router already code-splits per-route. Verify by inspecting `.next/server/app/` — every owner route should be its own chunk.

2. **Charts**: Recharts is heavy (~120KB gz). Defer with `next/dynamic`:

```typescript
// In src/app/(owner)/analytics/page.tsx
import dynamic from "next/dynamic";

const RevenueChart = dynamic(() => import("@/components/charts/RevenueChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px]" />,
});
```

Extract the `<AreaChart>` JSX into `src/components/charts/RevenueChart.tsx`.

3. **Images**: replace `<img>` with `next/image` for the listing hero photos. Configure `next.config.ts`:

```typescript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.cloudflarestorage.com" },
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_API_HOSTNAME ?? "localhost" },
    ],
  },
};
```

Use `next/image` only for fixed-aspect containers; raw `<img>` is fine for unknown-dimension uploads in the photo grid.

4. **Font subsetting**: `@fontsource` already ships Latin-only subsets at the URL we import. Confirm no extra weights are loaded — only `barlow-condensed/700`, `ibm-plex-sans/{400,500,600}`, `ibm-plex-mono/400`.

5. **Bundle audit**:

```bash
npm run build
```

Inspect the route table at the end. Each `(owner)` route should ship < 200 KB of First Load JS. Anything fatter — flag.

---

## Step 7: E2E smoke tests with Playwright

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

**File: `playwright.config.ts`** (owner-web/)

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
```

**File: `e2e/owner-happy-path.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_OWNER_EMAIL!;
const PASSWORD = process.env.E2E_OWNER_PASSWORD!;

test.describe("owner happy path", () => {
  test("login → dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("create a draft listing and see it in the list", async ({ page }) => {
    await page.goto("/listings/new");
    await page.getByLabel(/title/i).fill("E2E test crane");
    await page.getByLabel(/description/i).fill("Created from Playwright e2e. Twenty characters at least.");
    await page.getByLabel(/daily/i).fill("50000");
    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page).toHaveURL(/\/listings\/.+\/edit/);

    await page.goto("/listings");
    await expect(page.getByText("E2E test crane")).toBeVisible();
  });

  test("open inbox tabs", async ({ page }) => {
    await page.goto("/bookings");
    await page.getByRole("tab", { name: /confirmed/i }).click();
    await expect(page.getByRole("tab", { name: /confirmed/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("settings tabs navigate", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /bank/i }).click();
    await expect(page).toHaveURL(/\/settings\/bank/);
    await page.getByRole("link", { name: /notifications/i }).click();
    await expect(page).toHaveURL(/\/settings\/notifications/);
  });
});
```

Add to `package.json`:

```json
"e2e": "playwright test",
"e2e:headed": "playwright test --headed"
```

Run with a seeded owner account:

```bash
E2E_OWNER_EMAIL=owner@example.com E2E_OWNER_PASSWORD=password npm run e2e
```

All four tests must pass.

---

## Step 8: Deploy

The backend ships on Railway. The frontend deploys cleanly there too — or on Vercel for zero-config Next.js. **Default to Railway** to keep ops in one place.

### Railway

**File: `owner-web/railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/login"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
```

**File: `owner-web/nixpacks.toml`**

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

In the Railway project:

1. Add a new service from the GitHub repo root with `Root Directory = owner-web`.
2. Set environment variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://<terminal-backend>.railway.app`
   - `NEXT_PUBLIC_SENTRY_DSN=<dsn>`
   - `SESSION_COOKIE_NAME=terminal_session`
   - `SESSION_COOKIE_SECURE=true`
3. Add the same to the **backend** Railway service:
   - `CORS_ALLOWED_ORIGINS=https://owner.<your-domain>` (or the Railway-provided owner-web URL)
   - `CORS_ALLOW_ALL_ORIGINS=False`
4. Deploy. Verify the new owner-web URL boots, redirects to `/login`, and that signing in succeeds against the production backend.

### Vercel (alternative)

If using Vercel: import the repo, set `Root Directory = owner-web`, add the same env vars, deploy. No further config needed — Next.js builds out of the box.

---

## Step 9: Final QA pass

Run through the entire owner happy path on the deployed URL:

1. Register a new owner account (use a real phone for OTP).
2. Verify phone → land on dashboard.
3. Add a listing, upload three photos, set location, activate.
4. Have a renter (via the mobile app or a second account) request a booking.
5. Receive the request on the dashboard → accept it → confirm financial breakdown.
6. Open the message thread → send and receive messages live.
7. Mark the booking paid.
8. Review revenue and performance analytics for the period.
9. Update business profile, bank account, notifications.
10. Upload KYC documents.
11. Sign out → sign back in → middleware redirects correctly.

Document any failures in `owner-web/POST_DEPLOY_PUNCHLIST.md` and resolve before declaring v1 shipped.

---

## Step 10: Final commit + tag

```bash
git add owner-web/
git commit -m "owner-web: polish, observability, e2e, deploy — Wave 07"
git tag owner-web-v1
git push origin claude/analyze-design-system-2GRa4 --tags
```

---

## Definition of Done

- [ ] `ToasterProvider` mounted globally; mutations across listings, bookings, and settings surface success / failure toasts in dispatch voice
- [ ] `(owner)/error.tsx` and `(owner)/not-found.tsx` exist and follow TDS copy rules
- [ ] Every screen has reviewed empty, loading, and error states with the copy in Step 3
- [ ] Keyboard tab order, focus rings, and `aria-label`s verified across the app; no `text-text-tertiary` outside meta usage
- [ ] Sentry browser SDK installed and capturing 5xx errors via the API client
- [ ] Recharts loaded via `next/dynamic`; `next.config.ts` configures `images.remotePatterns` for the R2 host(s); no extra font weights load
- [ ] `npm run build` succeeds and every `(owner)` route's first-load JS is reported and under target
- [ ] Playwright config exists; the `e2e/owner-happy-path.spec.ts` suite runs locally against a seeded owner account and passes
- [ ] Railway `railway.toml` + `nixpacks.toml` exist under `owner-web/`; the service deploys
- [ ] Backend `CORS_ALLOWED_ORIGINS` updated to include the production owner-web origin; `CORS_ALLOW_ALL_ORIGINS=False` in prod
- [ ] Live deploy completes a full owner happy path end-to-end
- [ ] Git tag `owner-web-v1` is pushed
