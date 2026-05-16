"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Edit3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/tds/Badge";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ResourceIcon } from "@/components/tds/ResourceIcon";
import { StatusDot } from "@/components/tds/StatusDot";
import { Button } from "@/components/ui/Button";
import { SPECS_BY_RESOURCE, labelForSpecKey } from "@/components/listings/listingSpecConfig";
import { listingsApi } from "@/lib/api/listings";
import { QUERY_KEYS } from "@/lib/constants";
import { formatNaira } from "@/lib/format";

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const listing = useQuery({
    queryKey: QUERY_KEYS.listing(id),
    queryFn: () => listingsApi.get(id),
  });

  const stats = useQuery({
    queryKey: QUERY_KEYS.listingStats(id),
    queryFn: () => listingsApi.stats(id).then((r) => r.data),
    enabled: Boolean(listing.data),
  });

  const dup = useMutation({
    mutationFn: () => listingsApi.duplicate(id),
    onSuccess: (created) => router.replace(`/listings/${created.id}/edit`),
  });

  if (listing.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }
  if (!listing.data) {
    return <p className="text-alert-soft text-[13px]">Could not load the listing.</p>;
  }

  const l = listing.data;

  const specOrder = SPECS_BY_RESOURCE[l.resource_type].map((f) => f.key);
  const specEntries = Object.entries(l.specs)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => {
      const ia = specOrder.indexOf(a);
      const ib = specOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  function formatSpecValue(value: string | number | boolean): string {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);
    return value;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Listing · ${l.status}`}
        title={l.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => dup.mutate()} disabled={dup.isPending}>
              <Copy size={16} strokeWidth={1.5} aria-hidden /> Duplicate
            </Button>
            <Button asChild>
              <Link href={`/listings/${id}/edit`}>
                <Edit3 size={16} strokeWidth={1.5} aria-hidden /> Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-card border-border bg-surface aspect-[16/9] overflow-hidden border">
            {l.primary_photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={l.primary_photo_url} alt={l.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <ResourceIcon
                  type={l.resource_type}
                  size={80}
                  className="text-text-tertiary opacity-60"
                />
              </div>
            )}
          </div>

          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                <StatusDot status={l.status} className="mr-1.5" />
                {l.status}
              </Badge>
              <Badge tone="neutral">{l.resource_type}</Badge>
              {l.location_city ? <Badge tone="neutral">{l.location_city}</Badge> : null}
              {l.operator_available ? <Badge tone="info">Operator available</Badge> : null}
              {l.delivery_available ? <Badge tone="info">Delivery</Badge> : null}
            </div>
            <p className="text-text-secondary text-[14px] whitespace-pre-line">{l.description}</p>
          </Card>

          {specEntries.length > 0 ? (
            <Card>
              <div className="text-text-tertiary mb-3 text-[11px] tracking-[0.06em] uppercase">
                Specifications
              </div>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {specEntries.map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <dt className="text-text-tertiary text-[12px]">
                      {labelForSpecKey(l.resource_type, key) ?? key}
                    </dt>
                    <dd className="text-text-primary font-mono text-[14px]">{formatSpecValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="space-y-2">
              <div className="text-text-tertiary text-[11px] tracking-[0.06em] uppercase">
                Pricing
              </div>
              <div className="font-mono text-[20px]">
                {formatNaira(l.price_daily)}
                <span className="text-text-tertiary text-[12px]"> /day</span>
              </div>
              {l.price_weekly ? (
                <div className="text-text-secondary font-mono text-[13px]">
                  {formatNaira(l.price_weekly)} /week
                </div>
              ) : null}
              {l.price_monthly ? (
                <div className="text-text-secondary font-mono text-[13px]">
                  {formatNaira(l.price_monthly)} /mo
                </div>
              ) : null}
            </div>
          </Card>

          {stats.data ? (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Views" value={String(stats.data.view_count)} />
              <KpiCard label="Inquiries" value={String(stats.data.inquiry_count)} />
              <KpiCard label="Requests" value={String(stats.data.booking_request_count)} />
              <KpiCard label="Confirmed" value={String(stats.data.confirmed_booking_count)} />
              <KpiCard label="Conv. rate" value={`${stats.data.conversion_rate.toFixed(1)}%`} />
              <KpiCard
                label="Occupancy 90d"
                value={`${stats.data.occupancy_rate_90d.toFixed(1)}%`}
              />
              <KpiCard
                label="Gross revenue"
                value={formatNaira(stats.data.total_gross_revenue)}
                className="col-span-2"
              />
            </div>
          ) : (
            <Skeleton className="h-[200px]" />
          )}
        </div>
      </div>
    </div>
  );
}
