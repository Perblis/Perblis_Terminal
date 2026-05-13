# TERMINAL OWNER WEB — WAVE 02: APP SHELL + DASHBOARD

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 03 until the Definition of Done checklist is fully complete.

---

## Context

Wave 01 ended with a placeholder `/dashboard` page rendering raw JSON. This wave builds:

1. The persistent **app shell** for every authenticated owner route — left sidebar nav (desktop), top bar with breadcrumbs + user menu + notification bell, content well. Below 1024 px the sidebar collapses to a bottom tab bar (matching the TDS mobile pattern) and the top bar simplifies.
2. The **dashboard screen** — KPI grid, earnings sparkline, pending requests list, fleet snapshot — wired to `GET /api/v1/owner/dashboard/`.
3. Foundational TDS visual components used by the dashboard and reused everywhere afterward: `KpiCard`, `StatusDot`, `ResourceIcon`, `Avatar`, `Card`, `Badge`, `EmptyState`, `LoadingSkeleton`.

**Backend endpoint:**

`GET /api/v1/owner/dashboard/` →

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_listings": 42,
      "active_listings": 35,
      "pending_booking_requests": 5,
      "active_bookings": 8,
      "unread_messages": 3,
      "revenue_this_month": "45250.00"
    },
    "pending_requests": [
      { "id": "uuid", "listing_id": "uuid", "listing_title": "…",
        "renter_name": "…", "renter_photo": "url",
        "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",
        "gross_amount": "7500.00", "created_at": "ISO" }
    ],
    "recent_messages": [
      { "id": "uuid", "other_participant_name": "…",
        "other_participant_photo": "url",
        "listing_title": "…", "last_message_body": "…",
        "last_message_time": "ISO", "unread_count": 2 }
    ]
  }
}
```

**Reference for layout:** `ui_kits/mobile_app/OwnerDashboard.jsx` from `Terminal-Design`. Lift the visual pattern (4-up KPI grid, sparkline card, 3-px-left-border accent for new requests) and adapt to a desktop multi-column layout.

---

## Step 1: TDS visual primitives

**File: `src/components/tds/Card.tsx`**

```typescript
import * as React from "react";
import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  density?: "compact" | "default" | "spacious";
  accent?: "forge" | "clear" | "signal" | "amber" | "alert" | null;
  elevated?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, density = "default", accent = null, elevated = false, ...props }, ref) => {
    const pad = density === "compact" ? "p-3" : density === "spacious" ? "p-5" : "p-4";
    const accentClass = accent
      ? {
          forge: "border-l-[3px] border-l-forge pl-3",
          clear: "border-l-[3px] border-l-clear pl-3",
          signal: "border-l-[3px] border-l-signal pl-3",
          amber: "border-l-[3px] border-l-amber pl-3",
          alert: "border-l-[3px] border-l-alert pl-3",
        }[accent]
      : "";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-card border border-border",
          elevated ? "bg-surface-elevated" : "bg-surface",
          pad,
          accentClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";
```

**File: `src/components/tds/StatusDot.tsx`**

```typescript
import { cn } from "@/lib/cn";

const colorMap = {
  active: "bg-forge",
  available: "bg-clear",
  pending: "bg-amber",
  declined: "bg-alert",
  confirmed: "bg-signal",
  completed: "bg-text-tertiary",
  paused: "bg-text-tertiary",
  draft: "bg-text-tertiary",
  cancelled: "bg-alert",
  maintenance: "bg-amber",
} as const;

export function StatusDot({
  status,
  size = 8,
  className,
}: {
  status: keyof typeof colorMap;
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("rounded-full inline-block shrink-0", colorMap[status], className)}
    />
  );
}
```

**File: `src/components/tds/ResourceIcon.tsx`**

```typescript
import {
  Construction,
  Truck,
  Warehouse,
  Container,
  Fence,
  type LucideProps,
} from "lucide-react";
import type { ResourceType } from "@/lib/constants";

const map: Record<ResourceType, React.ComponentType<LucideProps>> = {
  equipment: Construction,
  vehicle: Truck,
  warehouse: Warehouse,
  terminal: Container,
  facility: Fence,
};

export function ResourceIcon({ type, ...rest }: { type: ResourceType } & LucideProps) {
  const C = map[type] ?? Construction;
  return <C strokeWidth={1.5} {...rest} />;
}
```

**File: `src/components/tds/Avatar.tsx`**

```typescript
"use client";

import * as A from "@radix-ui/react-avatar";
import { cn } from "@/lib/cn";

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <A.Root
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated",
        className,
      )}
    >
      {src ? (
        <A.Image src={src} alt={name} className="w-full h-full object-cover" />
      ) : null}
      <A.Fallback
        className="text-text-secondary font-body"
        style={{ fontSize: Math.max(10, size / 2.6) }}
      >
        {initials}
      </A.Fallback>
    </A.Root>
  );
}
```

**File: `src/components/tds/Badge.tsx`**

```typescript
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "info" | "warn" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-high text-text-secondary border-border",
  success: "bg-clear-dim text-clear-soft border-clear-dim",
  info: "bg-signal-dim text-signal-soft border-signal-dim",
  warn: "bg-amber-dim text-amber border-amber-dim",
  danger: "bg-alert-dim text-alert-soft border-alert-dim",
  accent: "bg-forge-dim text-forge-light border-forge-dim",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 h-5 rounded-pill border text-[11px] font-medium uppercase tracking-[0.06em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

**File: `src/components/tds/EmptyState.tsx`**

```typescript
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import Link from "next/link";

export function EmptyState({
  title,
  hint,
  cta,
  className,
}: {
  title: string;
  hint?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-5 text-center",
        className,
      )}
    >
      <div className="font-body text-text-primary text-[15px]">{title}</div>
      {hint ? <div className="font-body text-text-secondary text-[13px]">{hint}</div> : null}
      {cta ? (
        cta.href ? (
          <Button asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : (
          <Button onClick={cta.onClick}>{cta.label}</Button>
        )
      ) : null}
    </div>
  );
}
```

**File: `src/components/tds/LoadingSkeleton.tsx`**

```typescript
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded bg-surface-high overflow-hidden relative",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
        className,
      )}
    />
  );
}
```

Append to `src/app/globals.css`:

```css
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
```

**File: `src/components/tds/KpiCard.tsx`**

```typescript
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  const deltaColor =
    deltaTone === "positive"
      ? "text-clear-soft"
      : deltaTone === "negative"
        ? "text-alert-soft"
        : "text-text-secondary";

  return (
    <Card className={cn("space-y-1", className)}>
      <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">{label}</div>
      <div className="font-mono text-[22px] font-semibold text-text-primary">{value}</div>
      {delta ? <div className={cn("font-mono text-[11px]", deltaColor)}>{delta}</div> : null}
    </Card>
  );
}
```

---

## Step 2: App shell — sidebar, top bar, layout

**File: `src/components/layout/Sidebar.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  MessageSquare,
  LineChart,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "Listings", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex w-[224px] shrink-0 flex-col gap-1 border-r border-border bg-abyss px-3 py-5">
      <div className="px-2 pb-4">
        <div className="font-display uppercase text-[22px] leading-none tracking-tight">
          Terminal
        </div>
        <div className="font-body text-[11px] uppercase tracking-[0.06em] text-text-tertiary mt-1">
          Owner
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded text-[14px] font-body transition-colors duration-fast",
                active
                  ? "bg-forge-dim text-forge-light"
                  : "text-text-secondary hover:bg-surface-high hover:text-text-primary",
              )}
            >
              <Icon size={18} strokeWidth={1.5} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**File: `src/components/layout/MobileTabBar.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  MessageSquare,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/listings", label: "Listings", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Profile", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-abyss h-14 flex">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 text-[11px]",
              active ? "text-forge" : "text-text-secondary",
            )}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="uppercase tracking-[0.06em]">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

**File: `src/components/layout/TopBar.tsx`**

```typescript
"use client";

import { Bell, ChevronDown } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useMe, useLogout } from "@/hooks/useAuth";
import { Avatar } from "@/components/tds/Avatar";

export function TopBar() {
  const me = useMe();
  const logout = useLogout();
  const user = me.data;

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-abyss/95 backdrop-blur-0 px-5 flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
        {/* page title slot — pages render their own h1 below; keep this minimal */}
      </div>
      <div className="flex items-center gap-3">
        <button
          className="relative w-10 h-10 rounded-full border border-border bg-surface grid place-items-center text-text-secondary hover:text-text-primary"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-forge rounded-full border-2 border-surface" />
        </button>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button className="flex items-center gap-2 h-10 px-2 rounded hover:bg-surface-high text-text-primary">
              <Avatar
                src={null}
                name={user?.full_name ?? user?.email ?? "?"}
                size={28}
              />
              <span className="hidden sm:block text-[13px]">
                {user?.full_name ?? user?.email ?? ""}
              </span>
              <ChevronDown size={14} strokeWidth={1.5} className="text-text-tertiary" />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="end"
              sideOffset={6}
              className="min-w-[180px] rounded-card border border-border bg-surface-elevated p-1 shadow-none"
            >
              <Dropdown.Item asChild>
                <a
                  href="/settings"
                  className="block px-3 h-9 leading-9 rounded text-[13px] text-text-primary hover:bg-surface-high outline-none cursor-pointer"
                >
                  Settings
                </a>
              </Dropdown.Item>
              <Dropdown.Separator className="my-1 h-px bg-border" />
              <Dropdown.Item
                onSelect={() => logout.mutate()}
                className="px-3 h-9 leading-9 rounded text-[13px] text-alert-soft hover:bg-surface-high outline-none cursor-pointer"
              >
                Sign out
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
```

**File: `src/components/layout/Shell.tsx`**

```typescript
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-abyss">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col pb-14 lg:pb-0">
        <TopBar />
        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
```

**File: `src/app/(owner)/layout.tsx`** (replace the Wave 01 version)

```typescript
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Shell } from "@/components/layout/Shell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.is_owner) {
    redirect("/login?next=/dashboard&error=owner_required");
  }
  return <Shell>{children}</Shell>;
}
```

---

## Step 3: Page header helper

**File: `src/components/layout/PageHeader.tsx`**

```typescript
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display uppercase text-[28px] lg:text-[36px] leading-none tracking-tight mt-1">
          {title}
        </h1>
        {description ? (
          <p className="text-text-secondary text-[14px] mt-2 max-w-[640px]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
```

---

## Step 4: Owner API module (dashboard slice)

**File: `src/lib/api/owner.ts`**

```typescript
import { apiClient } from "./client";

export type DashboardStats = {
  total_listings: number;
  active_listings: number;
  pending_booking_requests: number;
  active_bookings: number;
  unread_messages: number;
  revenue_this_month: string;
};

export type DashboardPendingRequest = {
  id: string;
  listing_id: string;
  listing_title: string;
  renter_name: string;
  renter_photo: string | null;
  start_date: string;
  end_date: string;
  gross_amount: string;
  created_at: string;
};

export type DashboardRecentMessage = {
  id: string;
  other_participant_name: string;
  other_participant_photo: string | null;
  listing_title: string;
  last_message_body: string;
  last_message_time: string;
  unread_count: number;
};

export type DashboardData = {
  stats: DashboardStats;
  pending_requests: DashboardPendingRequest[];
  recent_messages: DashboardRecentMessage[];
};

export const ownerApi = {
  dashboard: () =>
    apiClient.get<{ success: true; data: DashboardData }>("/owner/dashboard/"),
};
```

---

## Step 5: Dashboard screen

**File: `src/app/(owner)/dashboard/page.tsx`** (replace Wave 01 placeholder)

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ownerApi } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";
import { formatNaira, formatDateRange, formatRelativeTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/tds/KpiCard";
import { Card } from "@/components/tds/Card";
import { Avatar } from "@/components/tds/Avatar";
import { EmptyState } from "@/components/tds/EmptyState";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { Badge } from "@/components/tds/Badge";

export default function DashboardPage() {
  const q = useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: () => ownerApi.dashboard().then((r) => r.data),
  });

  if (q.isLoading) return <DashboardSkeleton />;
  if (q.error) {
    return (
      <EmptyState
        title="Couldn't load dashboard."
        hint="Tap to retry."
        cta={{ label: "Retry", onClick: () => q.refetch() }}
      />
    );
  }

  const d = q.data!;
  const s = d.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Yard overview"
        title="Dashboard"
        description="Earnings, requests, and fleet at a glance."
      />

      {/* KPI grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Earnings (mo)" value={formatNaira(s.revenue_this_month)} />
        <KpiCard label="Active listings" value={String(s.active_listings)} />
        <KpiCard label="Total listings" value={String(s.total_listings)} />
        <KpiCard label="Pending requests" value={String(s.pending_booking_requests)} />
        <KpiCard label="Active bookings" value={String(s.active_bookings)} />
        <KpiCard label="Unread messages" value={String(s.unread_messages)} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending requests */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-text-primary">
              Pending requests{" "}
              <span className="text-text-tertiary font-normal">
                ({d.pending_requests.length})
              </span>
            </h2>
            <Link href="/bookings?status=pending" className="text-[13px] text-forge">
              View all
            </Link>
          </div>

          {d.pending_requests.length === 0 ? (
            <Card>
              <EmptyState
                title="No new requests."
                hint="Check back later or share your listings."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {d.pending_requests.slice(0, 5).map((r) => {
                const isNew =
                  Date.now() - new Date(r.created_at).getTime() < 1000 * 60 * 60 * 6;
                return (
                  <Link key={r.id} href={`/bookings/${r.id}`} className="block">
                    <Card accent={isNew ? "forge" : null} className="hover:bg-surface-high transition-colors duration-fast">
                      <div className="flex items-start gap-3">
                        <Avatar src={r.renter_photo} name={r.renter_name} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-body font-semibold text-[14px] text-text-primary truncate">
                              {r.renter_name}
                            </span>
                            <span className="font-mono text-[11px] text-text-tertiary shrink-0">
                              {formatRelativeTime(r.created_at)}
                            </span>
                          </div>
                          <div className="text-[13px] text-text-secondary truncate">
                            {r.listing_title}
                          </div>
                          <div className="flex items-baseline justify-between mt-1 font-mono text-[12px]">
                            <span className="text-text-tertiary">
                              {formatDateRange(r.start_date, r.end_date)}
                            </span>
                            <span className="text-forge-light">
                              {formatNaira(r.gross_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent messages */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-text-primary">
              Recent messages
            </h2>
            <Link href="/messages" className="text-[13px] text-forge">
              Open inbox
            </Link>
          </div>

          {d.recent_messages.length === 0 ? (
            <Card>
              <EmptyState title="Inbox is empty." />
            </Card>
          ) : (
            <div className="space-y-2">
              {d.recent_messages.slice(0, 5).map((m) => (
                <Link key={m.id} href={`/messages/${m.id}`} className="block">
                  <Card className="hover:bg-surface-high transition-colors duration-fast">
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={m.other_participant_photo}
                        name={m.other_participant_name}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-body font-semibold text-[14px] text-text-primary truncate">
                            {m.other_participant_name}
                          </span>
                          <span className="font-mono text-[11px] text-text-tertiary shrink-0">
                            {formatRelativeTime(m.last_message_time)}
                          </span>
                        </div>
                        <div className="text-[12px] text-text-tertiary truncate">
                          {m.listing_title}
                        </div>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <p className="text-[13px] text-text-secondary truncate">
                            {m.last_message_body}
                          </p>
                          {m.unread_count > 0 ? (
                            <Badge tone="accent">{m.unread_count}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[320px]" />
      </div>
    </div>
  );
}
```

---

## Step 6: Placeholder pages for remaining nav items

Create these stubs so the sidebar navigates without 404s. They are fleshed out in later waves.

**File: `src/app/(owner)/listings/page.tsx`**

```typescript
import { PageHeader } from "@/components/layout/PageHeader";

export default function ListingsPage() {
  return (
    <>
      <PageHeader title="Listings" description="Wave 03 — coming next." />
    </>
  );
}
```

Repeat for:

- `src/app/(owner)/bookings/page.tsx` — title "Bookings", description "Wave 04 — coming next."
- `src/app/(owner)/messages/page.tsx` — title "Messages", description "Wave 05 — coming next."
- `src/app/(owner)/analytics/page.tsx` — title "Analytics", description "Wave 06 — coming next."
- `src/app/(owner)/settings/page.tsx` — title "Settings", description "Wave 06 — coming next."

---

## Step 7: Smoke test

Backend running with an owner account that has at least one listing and one pending booking request (seed via Django admin or factories).

```bash
npm run dev
```

1. Sign in. Sidebar renders on `≥1024 px`, mobile tab bar on `<1024 px`.
2. Dashboard renders with 6 KPI cards in a single row at `≥1280 px`, wraps below.
3. Pending requests render with **3 px left Forge border** on requests <6 hours old, plain border otherwise.
4. Currency renders as `₦45,000` (no decimals, ₦ symbol, comma).
5. Date ranges use the en dash: `May 10 – May 13`.
6. Relative timestamps render as `2m ago`, `1h ago`, `3d ago`.
7. With zero pending requests, the empty state appears with the title "No new requests."
8. Click a request → routes to `/bookings/{id}` (404 for now — Wave 04).
9. Sign out from the top bar dropdown → returns to `/login`.

---

## Step 8: Commit

```bash
git add owner-web/src
git commit -m "owner-web: app shell + dashboard wired to /owner/dashboard — Wave 02"
```

---

## Definition of Done

- [ ] `Card`, `KpiCard`, `StatusDot`, `ResourceIcon`, `Avatar`, `Badge`, `EmptyState`, `Skeleton` exist in `src/components/tds/`
- [ ] `Sidebar`, `TopBar`, `MobileTabBar`, `Shell`, `PageHeader` exist in `src/components/layout/`
- [ ] `(owner)/layout.tsx` wraps every owner page in `<Shell>` and enforces `is_owner` at the server
- [ ] Below 1024 px the sidebar collapses to a bottom tab bar (Listings · Bookings · Messages · Profile)
- [ ] `src/lib/api/owner.ts` exposes `ownerApi.dashboard()` returning typed `DashboardData`
- [ ] `/dashboard` renders all 6 KPI values, both side-by-side panels (pending requests + recent messages), and loading skeletons
- [ ] Pending requests <6h old display the 3 px **left Forge border** accent on the card
- [ ] Currency uses `formatNaira` everywhere; date ranges use `formatDateRange`; timestamps use `formatRelativeTime`
- [ ] Empty states use the dispatch voice ("No new requests." not "You don't have any requests yet.")
- [ ] No console warnings or errors on dashboard load
- [ ] `npm run typecheck` passes
- [ ] Git commit `owner-web: app shell + dashboard wired to /owner/dashboard — Wave 02` is made
