"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { BookingRow } from "@/components/tds/BookingRow";
import { EmptyState } from "@/components/tds/EmptyState";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { bookingsApi } from "@/lib/api/bookings";
import { QUERY_KEYS, type BookingStatus } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CalendarDays } from "lucide-react";

const TABS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

export default function BookingsInboxPage() {
  const [tab, setTab] = useState<BookingStatus | "all">("pending");
  const filters = tab === "all" ? {} : { status: tab };

  const q = useQuery({
    queryKey: QUERY_KEYS.bookings(filters),
    queryFn: () => bookingsApi.list(filters),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Accept, decline, and track every request."
        actions={
          <Button asChild variant="secondary">
            <Link href="/bookings/calendar">
              <CalendarDays size={16} strokeWidth={1.5} /> Calendar
            </Link>
          </Button>
        }
      />

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List className="flex border-b border-border gap-1 overflow-x-auto tds-no-scrollbar">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="px-4 h-10 text-[13px] font-medium uppercase tracking-[0.06em] text-text-secondary data-[state=active]:text-forge data-[state=active]:border-b-2 data-[state=active]:border-forge -mb-px"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value={tab} className="pt-5">
          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px]" />
              ))}
            </div>
          ) : q.data && q.data.results.length === 0 ? (
            <EmptyState
              title={tab === "pending" ? "No requests waiting." : "Nothing here."}
              hint={tab === "pending" ? "Check back later." : undefined}
            />
          ) : (
            <div className="space-y-2 max-w-[720px]">
              {q.data!.results.map((b) => (
                <BookingRow key={b.id} booking={b} href={`/bookings/${b.id}`} />
              ))}
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
