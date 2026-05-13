# TERMINAL OWNER WEB — WAVE 06: ANALYTICS + SETTINGS

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 07 until the Definition of Done checklist is fully complete.

---

## Context

This wave delivers the last two product surfaces:

1. **Analytics** — two sub-pages:
   - **Revenue** — `GET /api/v1/owner/analytics/revenue/?period=&year=&month=` — gross / commission / payout totals, monthly trend chart, and per-listing breakdown.
   - **Performance** — `GET /api/v1/owner/analytics/performance/?period=` — views, inquiries, bookings, conversion rate, occupancy rate per listing.

2. **Settings** — three sub-pages, each its own card section but routed under `/settings`:
   - **Business profile** — `GET/PUT/PATCH /api/v1/owner/business-profile/` — name, description, logo upload.
   - **Bank account** — `GET/PUT/PATCH /api/v1/owner/bank-account/` — Nigerian 10-digit account validation.
   - **Notifications** — `GET/PUT/PATCH /api/v1/owner/notifications/` — four boolean preferences.
   - **Account & KYC** — `PATCH /api/v1/users/me/role/`, `POST /api/v1/users/me/documents/`, `POST /api/v1/auth/password/change/`.

The settings page uses a tabbed layout (Profile · Bank · Notifications · Account).

---

## Step 1: Extend owner API module

**File: `src/lib/api/owner.ts`** — append:

```typescript
// --- Existing types preserved above ---

export type RevenuePeriod = "month" | "quarter" | "year" | "all";

export type RevenueByListing = {
  listing_id: string;
  listing_title: string;
  resource_type: string;
  gross_total: string;
  commission_total: string;
  payout_total: string;
  booking_count: number;
};

export type RevenueTrendPoint = {
  year: number;
  month: number;
  month_label: string;
  gross_total: string;
  booking_count: number;
};

export type RevenueData = {
  gross_total: string;
  commission_total: string;
  payout_total: string;
  booking_count: number;
  avg_booking_value: string;
  by_listing: RevenueByListing[];
  monthly_trend: RevenueTrendPoint[];
};

export type PerformancePeriod = "last_30_days" | "last_90_days" | "last_year" | "all";

export type PerformanceByListing = {
  listing_id: string;
  listing_title: string;
  resource_type: string;
  status: string;
  views: number;
  inquiry_count: number;
  booking_request_count: number;
  confirmed_booking_count: number;
  occupancy_rate: number;
  conversion_rate: number;
};

export type PerformanceData = {
  total_views: number;
  total_inquiries: number;
  total_booking_requests: number;
  total_confirmed: number;
  overall_conversion_rate: number;
  by_listing: PerformanceByListing[];
};

export type BusinessProfile = {
  id: string;
  business_name: string | null;
  business_description: string | null;
  business_logo: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  notify_new_booking_request: boolean;
  notify_booking_confirmed: boolean;
  notify_new_message: boolean;
  notify_booking_cancelled: boolean;
  created_at: string;
  updated_at: string;
};

export const ownerAnalyticsApi = {
  revenue: (period: RevenuePeriod, year?: number, month?: number) =>
    apiClient.get<{ success: true; period: string; period_label: string; data: RevenueData }>(
      "/owner/analytics/revenue/",
      { query: { period, year, month } },
    ),

  performance: (period: PerformancePeriod) =>
    apiClient.get<{ success: true; period: string; period_label: string; data: PerformanceData }>(
      "/owner/analytics/performance/",
      { query: { period } },
    ),
};

export const ownerSettingsApi = {
  getProfile: () =>
    apiClient.get<{ success: true; data: BusinessProfile }>("/owner/business-profile/"),

  patchProfile: (body: FormData | Partial<BusinessProfile>) =>
    body instanceof FormData
      ? apiClient.upload<{ success: true; data: BusinessProfile }>(
          "/owner/business-profile/",
          body,
        )
      : apiClient.patch<{ success: true; data: BusinessProfile }>(
          "/owner/business-profile/",
          body,
        ),

  getBank: () =>
    apiClient.get<{ success: true; data: Pick<BusinessProfile, "bank_name" | "bank_account_number" | "bank_account_name"> }>(
      "/owner/bank-account/",
    ),

  patchBank: (body: { bank_name: string; bank_account_number: string; bank_account_name: string }) =>
    apiClient.patch<{ success: true; data: BusinessProfile }>("/owner/bank-account/", body),

  getNotifications: () =>
    apiClient.get<{
      success: true;
      data: Pick<
        BusinessProfile,
        | "notify_new_booking_request"
        | "notify_booking_confirmed"
        | "notify_new_message"
        | "notify_booking_cancelled"
      >;
    }>("/owner/notifications/"),

  patchNotifications: (body: Partial<Pick<
    BusinessProfile,
    | "notify_new_booking_request"
    | "notify_booking_confirmed"
    | "notify_new_message"
    | "notify_booking_cancelled"
  >>) =>
    apiClient.patch<{ success: true; data: BusinessProfile }>("/owner/notifications/", body),
};
```

> If the PUT/PATCH distinction is enforced by the backend (PUT requires every field, PATCH allows partials), prefer PATCH everywhere except for full-form replaces.

---

## Step 2: Analytics shell

**File: `src/app/(owner)/analytics/layout.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/analytics", label: "Revenue" },
  { href: "/analytics/performance", label: "Performance" },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <nav className="flex border-b border-border">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 h-10 inline-flex items-center text-[13px] font-medium uppercase tracking-[0.06em] -mb-px",
                active
                  ? "text-forge border-b-2 border-forge"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

---

## Step 3: Revenue page

**File: `src/app/(owner)/analytics/page.tsx`** (replace stub)

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerAnalyticsApi, type RevenuePeriod } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";
import { formatNaira } from "@/lib/format";

const PERIODS: { id: RevenuePeriod; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

export default function RevenuePage() {
  const [period, setPeriod] = useState<RevenuePeriod>("month");

  const q = useQuery({
    queryKey: QUERY_KEYS.revenue(period),
    queryFn: () => ownerAnalyticsApi.revenue(period),
  });

  return (
    <>
      <PageHeader
        title="Revenue"
        description={q.data?.period_label ?? "Earnings, commission, and payout."}
        actions={
          <div className="flex border border-border rounded overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={
                  "px-3 h-9 text-[12px] uppercase tracking-[0.06em] " +
                  (period === p.id ? "bg-forge text-text-on-accent" : "bg-surface text-text-secondary")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : !q.data ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Gross" value={formatNaira(q.data.data.gross_total)} />
            <KpiCard
              label={`Commission (${q.data.data.booking_count} bookings)`}
              value={formatNaira(q.data.data.commission_total)}
            />
            <KpiCard label="Your payout" value={formatNaira(q.data.data.payout_total)} />
            <KpiCard label="Avg. booking" value={formatNaira(q.data.data.avg_booking_value)} />
          </div>

          {/* Trend */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Monthly trend
              </h2>
              <span className="font-mono text-[11px] text-text-tertiary">
                {q.data.data.monthly_trend.length} months
              </span>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <AreaChart data={q.data.data.monthly_trend}>
                  <defs>
                    <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF8C24" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#FF8C24" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month_label"
                    stroke="#52526A"
                    tickLine={false}
                    axisLine={false}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#52526A"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₦${(Number(v) / 1000).toFixed(0)}k`}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A22",
                      border: "1px solid #2A2A36",
                      borderRadius: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#8E8EA8" }}
                    formatter={(v: number) => [formatNaira(String(v)), "Gross"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="gross_total"
                    stroke="#FF8C24"
                    strokeWidth={1.5}
                    fill="url(#spark)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* By listing */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">By listing</h2>
              <span className="font-mono text-[11px] text-text-tertiary">
                {q.data.data.by_listing.length} listings
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary text-left">
                  <th className="px-4 py-2 font-medium">Listing</th>
                  <th className="px-4 py-2 font-medium text-right">Bookings</th>
                  <th className="px-4 py-2 font-medium text-right">Gross</th>
                  <th className="px-4 py-2 font-medium text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.by_listing.map((row) => (
                  <tr key={row.listing_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-[14px]">{row.listing_title}</div>
                      <div className="text-[11px] text-text-tertiary uppercase tracking-[0.06em]">
                        {row.resource_type}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.booking_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {formatNaira(row.gross_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-forge-light">
                      {formatNaira(row.payout_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
```

---

## Step 4: Performance page

**File: `src/app/(owner)/analytics/performance/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerAnalyticsApi, type PerformancePeriod } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";
import { Badge } from "@/components/tds/Badge";

const PERIODS: { id: PerformancePeriod; label: string }[] = [
  { id: "last_30_days", label: "30 days" },
  { id: "last_90_days", label: "90 days" },
  { id: "last_year", label: "Year" },
  { id: "all", label: "All time" },
];

export default function PerformancePage() {
  const [period, setPeriod] = useState<PerformancePeriod>("last_30_days");

  const q = useQuery({
    queryKey: QUERY_KEYS.performance(period),
    queryFn: () => ownerAnalyticsApi.performance(period),
  });

  return (
    <>
      <PageHeader
        title="Performance"
        description={q.data?.period_label ?? "Views, inquiries, and conversion."}
        actions={
          <div className="flex border border-border rounded overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={
                  "px-3 h-9 text-[12px] uppercase tracking-[0.06em] " +
                  (period === p.id ? "bg-forge text-text-on-accent" : "bg-surface text-text-secondary")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : !q.data ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Views" value={String(q.data.data.total_views)} />
            <KpiCard label="Inquiries" value={String(q.data.data.total_inquiries)} />
            <KpiCard label="Requests" value={String(q.data.data.total_booking_requests)} />
            <KpiCard label="Confirmed" value={String(q.data.data.total_confirmed)} />
            <KpiCard
              label="Conversion"
              value={`${q.data.data.overall_conversion_rate.toFixed(1)}%`}
            />
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">By listing</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary text-left">
                  <th className="px-4 py-2 font-medium">Listing</th>
                  <th className="px-4 py-2 font-medium text-right">Views</th>
                  <th className="px-4 py-2 font-medium text-right">Inq.</th>
                  <th className="px-4 py-2 font-medium text-right">Req.</th>
                  <th className="px-4 py-2 font-medium text-right">Conf.</th>
                  <th className="px-4 py-2 font-medium text-right">Conv.</th>
                  <th className="px-4 py-2 font-medium text-right">Occ.</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.by_listing.map((row) => (
                  <tr key={row.listing_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-[14px]">{row.listing_title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge tone="neutral">{row.resource_type}</Badge>
                        <Badge tone="neutral">{row.status}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">{row.views}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.inquiry_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.booking_request_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.confirmed_booking_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.conversion_rate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {row.occupancy_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
```

---

## Step 5: Settings shell

**File: `src/app/(owner)/settings/layout.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/bank", label: "Bank" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <nav className="flex border-b border-border overflow-x-auto tds-no-scrollbar">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 h-10 inline-flex items-center text-[13px] font-medium uppercase tracking-[0.06em] -mb-px shrink-0",
                active
                  ? "text-forge border-b-2 border-forge"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

---

## Step 6: Business profile page

**File: `src/app/(owner)/settings/page.tsx`** (replace stub)

```typescript
"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerSettingsApi } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";

const schema = z.object({
  business_name: z.string().min(2, "Required."),
  business_description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BusinessProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEYS.businessProfile,
    queryFn: () => ownerSettingsApi.getProfile().then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (q.data) {
      reset({
        business_name: q.data.business_name ?? "",
        business_description: q.data.business_description ?? "",
      });
    }
  }, [q.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => ownerSettingsApi.patchProfile(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.businessProfile }),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("business_logo", file);
      return ownerSettingsApi.patchProfile(fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.businessProfile }),
  });

  if (q.isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <>
      <PageHeader title="Business profile" description="Shown to renters on your listings." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[920px]">
        <Card className="lg:col-span-1 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Logo</div>
          <div className="w-32 h-32 rounded-card overflow-hidden border border-border bg-surface-elevated grid place-items-center">
            {q.data?.business_logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={q.data.business_logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.06em]">
                No logo
              </span>
            )}
          </div>
          <label className="inline-block">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo.mutate(f);
              }}
            />
            <Button asChild variant="secondary" size="sm">
              <span>{uploadLogo.isPending ? "Uploading…" : "Upload logo"}</span>
            </Button>
          </label>
        </Card>

        <Card className="lg:col-span-2 space-y-4">
          <form
            onSubmit={handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
            noValidate
          >
            <Field id="business_name" label="Business name" error={errors.business_name?.message}>
              <Input id="business_name" {...register("business_name")} invalid={!!errors.business_name} />
            </Field>
            <Field
              id="business_description"
              label="Description"
              hint="Renters see this on every listing."
            >
              <textarea
                id="business_description"
                rows={5}
                {...register("business_description")}
                className="w-full rounded border border-border bg-surface-elevated p-3 text-[14px] font-body"
              />
            </Field>
            <div>
              <Button type="submit" disabled={isSubmitting || save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
```

---

## Step 7: Bank account page

**File: `src/app/(owner)/settings/bank/page.tsx`**

```typescript
"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerSettingsApi } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";

const schema = z.object({
  bank_name: z.string().min(2, "Required."),
  bank_account_number: z
    .string()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits."),
  bank_account_name: z.string().min(2, "Required."),
});

type FormValues = z.infer<typeof schema>;

export default function BankAccountPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEYS.bankAccount,
    queryFn: () => ownerSettingsApi.getBank().then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (q.data) {
      reset({
        bank_name: q.data.bank_name ?? "",
        bank_account_number: q.data.bank_account_number ?? "",
        bank_account_name: q.data.bank_account_name ?? "",
      });
    }
  }, [q.data, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => ownerSettingsApi.patchBank(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.bankAccount }),
  });

  if (q.isLoading) return <Skeleton className="h-[300px]" />;

  return (
    <>
      <PageHeader
        title="Bank account"
        description="Used for payouts. Must match the business name on file."
      />

      <Card className="max-w-[520px] space-y-4">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field id="bank_name" label="Bank" error={errors.bank_name?.message}>
            <Input id="bank_name" {...register("bank_name")} invalid={!!errors.bank_name} />
          </Field>
          <Field
            id="bank_account_number"
            label="Account number"
            hint="10 digits, no spaces."
            error={errors.bank_account_number?.message}
          >
            <Input
              id="bank_account_number"
              inputMode="numeric"
              maxLength={10}
              className="font-mono"
              invalid={!!errors.bank_account_number}
              {...register("bank_account_number")}
            />
          </Field>
          <Field id="bank_account_name" label="Account name" error={errors.bank_account_name?.message}>
            <Input
              id="bank_account_name"
              {...register("bank_account_name")}
              invalid={!!errors.bank_account_name}
            />
          </Field>

          {save.error ? (
            <p className="text-[13px] text-alert-soft">{(save.error as Error).message}</p>
          ) : null}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </>
  );
}
```

---

## Step 8: Notifications page

**File: `src/app/(owner)/settings/notifications/page.tsx`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Switch from "@radix-ui/react-switch";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ownerSettingsApi } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";

const ROWS: { key: keyof Awaited<ReturnType<typeof ownerSettingsApi.getNotifications>>["data"]; label: string; hint: string }[] = [
  { key: "notify_new_booking_request", label: "New booking request", hint: "A renter wants to book." },
  { key: "notify_booking_confirmed", label: "Booking confirmed", hint: "A renter accepts a counter or pays." },
  { key: "notify_new_message", label: "New message", hint: "Someone replies in a thread." },
  { key: "notify_booking_cancelled", label: "Booking cancelled", hint: "Either side cancels." },
];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => ownerSettingsApi.getNotifications().then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: (body: Partial<Awaited<ReturnType<typeof ownerSettingsApi.getNotifications>>["data"]>) =>
      ownerSettingsApi.patchNotifications(body),
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.notifications });
      const prev = qc.getQueryData(QUERY_KEYS.notifications);
      qc.setQueryData(QUERY_KEYS.notifications, (old: typeof q.data) => ({ ...(old ?? ({} as never)), ...partial }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.notifications, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
  });

  if (q.isLoading) return <Skeleton className="h-[300px]" />;

  return (
    <>
      <PageHeader title="Notifications" description="Choose what you want to be told about." />
      <Card className="max-w-[640px] divide-y divide-border p-0">
        {ROWS.map((r) => {
          const checked = !!q.data?.[r.key];
          return (
            <div key={r.key} className="flex items-center justify-between p-4">
              <div>
                <div className="text-[14px] font-medium">{r.label}</div>
                <div className="text-[12px] text-text-tertiary">{r.hint}</div>
              </div>
              <Switch.Root
                checked={checked}
                onCheckedChange={(v) => toggle.mutate({ [r.key]: v } as Parameters<typeof toggle.mutate>[0])}
                className="w-10 h-6 rounded-pill bg-surface-high border border-border data-[state=checked]:bg-forge relative"
              >
                <Switch.Thumb className="block w-4 h-4 bg-text-primary rounded-pill translate-x-1 data-[state=checked]:translate-x-5 transition-transform duration-fast" />
              </Switch.Root>
            </div>
          );
        })}
      </Card>
    </>
  );
}
```

---

## Step 9: Account + KYC + password page

**File: `src/app/(owner)/settings/account/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/tds/Badge";
import { useMe } from "@/hooks/useAuth";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";

export default function AccountSettingsPage() {
  const me = useMe();
  const user = me.data;

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const changePwd = useMutation({
    mutationFn: () => authApi.changePassword(oldPwd, newPwd, confirmPwd),
    onSuccess: () => {
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    },
  });

  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: "government_id" | "business_registration" }) =>
      usersApi.uploadDocument(file, type),
    onSuccess: () => me.refetch(),
  });

  const role = useMutation({
    mutationFn: (renter: boolean) => usersApi.updateRole(true, renter),
    onSuccess: () => me.refetch(),
  });

  return (
    <>
      <PageHeader title="Account" description="Identity, role, and password." />

      <div className="space-y-6 max-w-[680px]">
        {/* Identity */}
        <Card className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Identity</div>
          <div className="grid grid-cols-2 gap-3 font-mono text-[13px]">
            <div>
              <div className="text-text-tertiary text-[11px] uppercase tracking-[0.06em]">Email</div>
              <div className="mt-1">{user?.email}</div>
            </div>
            <div>
              <div className="text-text-tertiary text-[11px] uppercase tracking-[0.06em]">Phone</div>
              <div className="mt-1">{user?.phone}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge tone={user?.is_phone_verified ? "success" : "warn"}>
              {user?.is_phone_verified ? "Phone verified" : "Phone unverified"}
            </Badge>
            <Badge tone={user?.is_email_verified ? "success" : "warn"}>
              {user?.is_email_verified ? "Email verified" : "Email unverified"}
            </Badge>
            <Badge tone={user?.is_id_verified ? "success" : "neutral"}>
              {user?.is_id_verified ? "ID verified" : "ID not submitted"}
            </Badge>
          </div>
        </Card>

        {/* Role */}
        <Card className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Role</div>
          <p className="text-[14px] text-text-secondary">
            You're signed in as an owner. Enable renter mode to also book equipment.
          </p>
          <label className="flex items-center gap-3 text-[14px]">
            <input
              type="checkbox"
              checked={user?.is_renter ?? false}
              onChange={(e) => role.mutate(e.target.checked)}
            />
            Also act as a renter
          </label>
        </Card>

        {/* KYC */}
        <Card className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Verification</div>
          <p className="text-[14px] text-text-secondary">
            Upload one government ID and one business registration to unlock the verified badge on your listings.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-block">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate({ file: f, type: "government_id" });
                }}
              />
              <Button asChild variant="secondary" size="sm">
                <span>Upload government ID</span>
              </Button>
            </label>
            <label className="inline-block">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate({ file: f, type: "business_registration" });
                }}
              />
              <Button asChild variant="secondary" size="sm">
                <span>Upload business registration</span>
              </Button>
            </label>
          </div>
          {upload.isSuccess ? (
            <p className="text-[12px] text-clear-soft font-mono">
              Uploaded. We'll review and update your verification status.
            </p>
          ) : null}
        </Card>

        {/* Password */}
        <Card className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Password</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changePwd.mutate();
            }}
            className="space-y-3"
          >
            <Field id="old_pwd" label="Current password">
              <Input
                id="old_pwd"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
              />
            </Field>
            <Field id="new_pwd" label="New password">
              <Input
                id="new_pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </Field>
            <Field id="confirm_pwd" label="Confirm new password">
              <Input
                id="confirm_pwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </Field>
            {changePwd.error ? (
              <p className="text-[13px] text-alert-soft">{(changePwd.error as Error).message}</p>
            ) : null}
            {changePwd.isSuccess ? (
              <p className="text-[13px] text-clear-soft">Password changed.</p>
            ) : null}
            <Button
              type="submit"
              disabled={
                changePwd.isPending || !oldPwd || newPwd.length < 8 || newPwd !== confirmPwd
              }
            >
              {changePwd.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
```

---

## Step 10: Smoke test

Backend running with an owner that has bookings spanning multiple months (for revenue trend), several listings (for per-listing analytics), and an existing business profile.

```bash
npm run dev
```

1. `/analytics` defaults to the Revenue tab. The four KPI cards render gross / commission / payout / avg booking value with mono currency.
2. The monthly trend chart renders the same `#FF8C24` line + gradient fill the dashboard sparkline uses.
3. The per-listing table sorts and renders correctly. Switching period (Month/Quarter/Year/All) refetches.
4. `/analytics/performance` renders the 5-up KPI grid and the per-listing table with views/inquiries/requests/confirmed/conversion/occupancy.
5. `/settings` loads Business profile. Logo upload preview updates on success.
6. `/settings/bank` enforces 10-digit validation; submitting an 11-digit number shows the message exactly as specified.
7. `/settings/notifications` toggles preferences and updates the cache optimistically; reverting on API failure restores the previous state.
8. `/settings/account` shows verification badges in the right colors, allows KYC document upload, and changes password with confirmation.

---

## Step 11: Commit

```bash
git add owner-web/src
git commit -m "owner-web: analytics + settings (profile, bank, notifications, account) — Wave 06"
```

---

## Definition of Done

- [ ] `src/lib/api/owner.ts` exposes `ownerAnalyticsApi.revenue`, `ownerAnalyticsApi.performance`, `ownerSettingsApi.getProfile`, `patchProfile`, `getBank`, `patchBank`, `getNotifications`, `patchNotifications`
- [ ] `/analytics` (Revenue) renders four KPI cards, a Recharts area chart styled with TDS Forge orange + gradient, a per-listing table; period chips switch the dataset
- [ ] `/analytics/performance` renders five KPI cards and a per-listing table with views, inquiries, requests, confirmed, conversion %, occupancy %
- [ ] `/settings` tabs (Profile · Bank · Notifications · Account) work with active-tab indicator (forge underline)
- [ ] Business profile loads existing data, supports logo upload (multipart `business_logo`), and saves description/name patches
- [ ] Bank account form validates 10-digit Nigerian account numbers via Zod and saves on submit
- [ ] Notifications page toggles four boolean preferences with optimistic updates and revert-on-error
- [ ] Account page shows verification badges with correct tones, exposes role toggle (renter mode), supports KYC document upload (`government_id` and `business_registration`), and changes password
- [ ] All numeric values render in IBM Plex Mono via `formatNaira`
- [ ] All copy follows TDS voice; no emoji, no exclamations
- [ ] `npm run typecheck` passes
- [ ] Git commit `owner-web: analytics + settings (profile, bank, notifications, account) — Wave 06` is made
