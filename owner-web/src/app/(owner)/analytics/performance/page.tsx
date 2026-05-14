"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { EmptyState } from "@/components/tds/EmptyState";
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
  const [period, setPeriod] = useState<PerformancePeriod>("all");

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
      ) : !q.data ? null : q.data.data.by_listing.length === 0 ? (
        <EmptyState title="No data in this period." />
      ) : (
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
