"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  differenceInDays,
} from "date-fns";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/tds/Card";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { EmptyState } from "@/components/tds/EmptyState";
import { bookingsApi } from "@/lib/api/bookings";
import { QUERY_KEYS } from "@/lib/constants";
import { cn } from "@/lib/cn";

const STATUS_BAR_COLOR: Record<string, string> = {
  pending: "bg-amber",
  confirmed: "bg-signal",
  active: "bg-forge",
  completed: "bg-text-tertiary",
  declined: "bg-alert",
  cancelled: "bg-alert",
};

export default function BookingsCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const start = useMemo(() => startOfMonth(cursor), [cursor]);
  const end = useMemo(() => endOfMonth(cursor), [cursor]);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const days = differenceInDays(end, start) + 1;
  const dayList = Array.from({ length: days }, (_, i) => addDays(start, i));

  const q = useQuery({
    queryKey: QUERY_KEYS.calendar(startStr, endStr),
    queryFn: () => bookingsApi.calendar(startStr, endStr),
  });

  const monthLabel = format(cursor, "MMMM yyyy");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Bookings across your fleet."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft size={14} strokeWidth={1.5} />
            </Button>
            <div className="font-mono text-[14px] min-w-[140px] text-center">{monthLabel}</div>
            <Button variant="secondary" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-[420px]" />
      ) : !q.data || q.data.data.length === 0 ? (
        <EmptyState title="No bookings this month." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div
            className="grid"
            style={{ gridTemplateColumns: `200px repeat(${days}, minmax(28px, 1fr))` }}
          >
            <div className="px-3 py-2 border-r border-b border-border text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
              Listing
            </div>
            {dayList.map((d) => (
              <div
                key={d.toISOString()}
                className="border-r border-b border-border px-1 py-2 text-center font-mono text-[10px] text-text-tertiary"
              >
                {format(d, "d")}
              </div>
            ))}

            {q.data!.data.map((row) => (
              <Row key={row.id} row={row} dayList={dayList} days={days} start={start} />
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-4 font-mono text-[11px] text-text-tertiary">
        <Legend label="Pending" colorClass={STATUS_BAR_COLOR.pending} />
        <Legend label="Confirmed" colorClass={STATUS_BAR_COLOR.confirmed} />
        <Legend label="Active" colorClass={STATUS_BAR_COLOR.active} />
        <Legend label="Cancelled" colorClass={STATUS_BAR_COLOR.cancelled} />
      </div>
    </div>
  );
}

function Row({
  row,
  dayList,
  days,
  start,
}: {
  row: {
    id: string;
    title: string;
    bookings: {
      id: string;
      start_date: string;
      end_date: string;
      status: string;
    }[];
  };
  dayList: Date[];
  days: number;
  start: Date;
}) {
  return (
    <>
      <div className="px-3 py-3 border-r border-b border-border min-w-0">
        <div className="text-[13px] font-medium truncate">{row.title}</div>
      </div>
      <div
        className="col-span-full border-b border-border relative"
        style={{ gridColumn: `2 / span ${days}` }}
      >
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${days}, minmax(28px, 1fr))` }}
        >
          {dayList.map((d) => (
            <div key={d.toISOString()} className="border-r border-border h-12" />
          ))}
        </div>
        {row.bookings.map((b) => {
          const s = new Date(b.start_date);
          const e = new Date(b.end_date);
          const startIdx = Math.max(0, differenceInDays(s, start));
          const endIdx = Math.min(days - 1, differenceInDays(e, start));
          if (endIdx < 0 || startIdx > days - 1) return null;
          const left = (startIdx / days) * 100;
          const width = ((endIdx - startIdx + 1) / days) * 100;
          return (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className={cn(
                "absolute top-2 h-8 rounded text-[11px] font-mono px-2 flex items-center text-text-on-accent overflow-hidden",
                STATUS_BAR_COLOR[b.status] ?? "bg-text-tertiary",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${b.status}`}
            >
              <span className="truncate">{b.status}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Legend({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-3 h-3 rounded", colorClass)} />
      {label}
    </span>
  );
}
