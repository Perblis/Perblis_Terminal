"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { EmptyState } from "@/components/tds/EmptyState";
import { ownerAnalyticsApi, type RevenuePeriod } from "@/lib/api/owner";

const RevenueChart = dynamic(() => import("@/components/charts/RevenueChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px]" />,
});
import { QUERY_KEYS } from "@/lib/constants";
import { formatNaira } from "@/lib/format";

const PERIODS: { id: RevenuePeriod; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

export default function RevenuePage() {
  const [period, setPeriod] = useState<RevenuePeriod>("all");

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
                  (period === p.id
                    ? "bg-forge text-text-on-accent"
                    : "bg-surface text-text-secondary")
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
      ) : !q.data ? null : q.data.data.booking_count === 0 ? (
        <EmptyState title="No bookings in this period." />
      ) : (
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

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Monthly trend
              </h2>
              <span className="font-mono text-[11px] text-text-tertiary">
                {q.data.data.monthly_trend.length} months
              </span>
            </div>
            <RevenueChart data={q.data.data.monthly_trend} />
          </Card>

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
