"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/tds/Avatar";
import { Badge } from "@/components/tds/Badge";
import { Card } from "@/components/tds/Card";
import { EmptyState } from "@/components/tds/EmptyState";
import { KpiCard } from "@/components/tds/KpiCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { loadTokensFromStorage } from "@/lib/api/client";
import { ownerApi } from "@/lib/api/owner";
import type { ActivityFeedItem } from "@/lib/api/owner";
import { QUERY_KEYS } from "@/lib/constants";
import { formatDateRange, formatNaira, formatRelativeTime } from "@/lib/format";

const NEW_REQUEST_THRESHOLD_MS = 1000 * 60 * 60 * 6;

export default function DashboardPage() {
  useEffect(() => {
    loadTokensFromStorage();
  }, []);

  const q = useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: () => ownerApi.dashboard().then((r) => r.data),
    retry: false,
  });

  if (q.isLoading) return <DashboardSkeleton />;
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader eyebrow="Yard overview" title="Dashboard" />
        <Card>
          <EmptyState
            title="Couldn't load dashboard."
            hint="Tap to retry."
            cta={{ label: "Retry", onClick: () => q.refetch() }}
          />
        </Card>
      </>
    );
  }

  const d = q.data;
  const s = d.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Yard overview"
        title="Dashboard"
        description="Earnings, requests, and fleet at a glance."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Earnings (mo)" value={formatNaira(s.revenue_this_month)} />
        <KpiCard label="Active listings" value={String(s.active_listings)} />
        <KpiCard label="Total listings" value={String(s.total_listings)} />
        <KpiCard label="Pending requests" value={String(s.pending_booking_requests)} />
        <KpiCard label="Active bookings" value={String(s.active_bookings)} />
        <KpiCard label="Unread messages" value={String(s.unread_messages)} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PendingRequestsPanel requests={d.pending_requests} />
        <RecentMessagesPanel messages={d.recent_messages} />
      </div>

      <ActivityFeedPanel />
    </div>
  );
}

function PendingRequestsPanel({
  requests,
}: {
  requests: import("@/lib/api/owner").DashboardPendingRequest[];
}) {
  // Capture "now" once on mount so render stays pure (React 19 / react-hooks/purity).
  const [nowMs] = useState(() => Date.now());

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-text-primary text-[13px] font-semibold tracking-[0.04em] uppercase">
          Pending requests{" "}
          <span className="text-text-tertiary font-normal">({requests.length})</span>
        </h2>
        <Link href="/bookings?status=pending" className="text-forge text-[13px]">
          View all
        </Link>
      </div>

      {requests.length === 0 ? (
        <Card>
          <EmptyState title="No new requests." hint="Check back later or share your listings." />
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.slice(0, 5).map((r) => {
            const isNew = nowMs - new Date(r.created_at).getTime() < NEW_REQUEST_THRESHOLD_MS;
            return (
              <Link key={r.id} href={`/bookings/${r.id}`} className="block focus:outline-none">
                <Card
                  accent={isNew ? "forge" : null}
                  className="hover:bg-surface-high duration-fast transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar src={r.renter_photo} name={r.renter_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body text-text-primary truncate text-[14px] font-semibold">
                          {r.renter_name}
                        </span>
                        <span className="text-text-tertiary shrink-0 font-mono text-[11px]">
                          {formatRelativeTime(r.created_at)}
                        </span>
                      </div>
                      <div className="text-text-secondary truncate text-[13px]">
                        {r.listing_title}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between font-mono text-[12px]">
                        <span className="text-text-tertiary">
                          {formatDateRange(r.start_date, r.end_date)}
                        </span>
                        <span className="text-forge-light">{formatNaira(r.gross_amount)}</span>
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
  );
}

function RecentMessagesPanel({
  messages,
}: {
  messages: import("@/lib/api/owner").DashboardRecentMessage[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-text-primary text-[13px] font-semibold tracking-[0.04em] uppercase">
          Recent messages
        </h2>
        <Link href="/messages" className="text-forge text-[13px]">
          Open inbox
        </Link>
      </div>

      {messages.length === 0 ? (
        <Card>
          <EmptyState title="Inbox is empty." />
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.slice(0, 5).map((m) => (
            <Link key={m.id} href={`/messages/${m.id}`} className="block focus:outline-none">
              <Card className="hover:bg-surface-high duration-fast transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar
                    src={m.other_participant_photo}
                    name={m.other_participant_name}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-body text-text-primary truncate text-[14px] font-semibold">
                        {m.other_participant_name}
                      </span>
                      <span className="text-text-tertiary shrink-0 font-mono text-[11px]">
                        {m.last_message_time ? formatRelativeTime(m.last_message_time) : "—"}
                      </span>
                    </div>
                    <div className="text-text-tertiary truncate text-[12px]">{m.listing_title}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-text-secondary truncate text-[13px]">
                        {m.last_message_body ?? "No messages yet."}
                      </p>
                      {m.unread_count > 0 ? <Badge tone="accent">{m.unread_count}</Badge> : null}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const ACTIVITY_ICONS: Record<ActivityFeedItem["type"], { icon: string; color: string }> = {
  booking_request: { icon: "📋", color: "text-amber-400" },
  booking_confirmed: { icon: "✓", color: "text-emerald-400" },
  booking_active: { icon: "▶", color: "text-blue-400" },
  booking_completed: { icon: "✔", color: "text-emerald-500" },
  booking_cancelled: { icon: "✗", color: "text-red-400" },
  booking_declined: { icon: "−", color: "text-red-400" },
  message: { icon: "💬", color: "text-blue-400" },
};

function ActivityFeedPanel() {
  const q = useQuery({
    queryKey: QUERY_KEYS.activityFeed,
    queryFn: () => ownerApi.activityFeed().then((r) => r.data),
    retry: false,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-text-primary text-[13px] font-semibold tracking-[0.04em] uppercase">
          Activity feed
        </h2>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <Card>
          <EmptyState
            title="Couldn't load activity."
            hint="Tap to retry."
            cta={{ label: "Retry", onClick: () => q.refetch() }}
          />
        </Card>
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState title="No recent activity." hint="Activity will appear here as bookings and messages come in." />
        </Card>
      ) : (
        <div className="space-y-2">
          {q.data.slice(0, 15).map((item) => {
            const iconMeta = ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.booking_request;
            return (
              <Link key={item.id} href={item.link} className="block focus:outline-none">
                <Card className="hover:bg-surface-high duration-fast transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar src={item.actor_photo} name={item.actor_name} size={36} />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-elevated text-[10px] leading-none ${iconMeta.color}`}
                      >
                        {iconMeta.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body text-text-primary truncate text-[14px] font-semibold">
                          {item.actor_name}
                        </span>
                        <span className="text-text-tertiary shrink-0 font-mono text-[11px]">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                      <div className="text-text-secondary truncate text-[13px]">
                        {item.title}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between font-mono text-[12px]">
                        <span className="text-text-tertiary truncate">{item.subtitle}</span>
                        {item.amount && (
                          <span className="text-forge-light shrink-0 ml-2">
                            {formatNaira(item.amount)}
                          </span>
                        )}
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
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[320px]" />
      </div>
    </div>
  );
}
