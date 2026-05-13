# TERMINAL OWNER WEB — WAVE 04: BOOKINGS

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 05 until the Definition of Done checklist is fully complete.

---

## Context

This wave delivers the **bookings management** surface for owners:

1. **Inbox** — filterable list of bookings (default tab: Pending), grouped by status with action buttons.
2. **Booking detail** — full renter card, dates, financial breakdown (gross/commission/payout), accept / decline / cancel / mark-paid actions, link to the message thread.
3. **Calendar** — month-view timeline of bookings across every listing the owner has. Reads `/owner/bookings/calendar/`.

### Backend endpoints used

| Endpoint | Method | Notes |
|---|---|---|
| `GET /api/v1/bookings/` | GET | Default returns the owner's bookings (and renter's, for accounts with both roles). Filter by `status`, `listing_id`, `start_after`, `start_before`. |
| `GET /api/v1/bookings/{id}/` | GET | Detail. |
| `PATCH /api/v1/bookings/{id}/accept/` | PATCH | Empty body. Validates `status=pending` and checks date conflicts. |
| `PATCH /api/v1/bookings/{id}/decline/` | PATCH | Body: `{reason?: string}`. |
| `PATCH /api/v1/bookings/{id}/cancel/` | PATCH | Body: `{reason?: string}`. Both renter and owner can cancel; allowed when `status ∈ {pending, confirmed}`. |
| `PATCH /api/v1/bookings/{id}/pay/` | PATCH | Empty body. Simulated payment. Allowed when `status=confirmed`. |
| `GET /api/v1/owner/bookings/calendar/` | GET | Query: `start_date`, `end_date` (max 90 days). Returns listings with their bookings nested. |

### Booking shape (relevant fields)

```typescript
{
  id: string;
  renter_id: string;
  owner_id: string;
  listing_id: string;
  listing_title: string;
  renter_name: string;
  renter_photo: string | null;
  start_date: string;       // YYYY-MM-DD
  end_date: string;
  duration_type: "daily" | "weekly" | "monthly";
  gross_amount: string;
  commission_amount: string;
  owner_payout_amount: string;
  commission_rate: string;  // "10.00"
  status: "pending" | "confirmed" | "declined" | "active" | "completed" | "cancelled";
  payment_status: "unpaid" | "simulated_paid";
  renter_note: string | null;
  cancellation_reason: string | null;
  thread_id: string | null;
  created_at: string;
}
```

---

## Step 1: Bookings API module

**File: `src/lib/api/bookings.ts`**

```typescript
import { apiClient } from "./client";
import type { BookingStatus } from "@/lib/constants";

export type Booking = {
  id: string;
  renter_id: string;
  owner_id: string;
  listing_id: string;
  listing_title: string;
  renter_name: string;
  renter_photo: string | null;
  start_date: string;
  end_date: string;
  duration_type: "daily" | "weekly" | "monthly";
  gross_amount: string;
  commission_amount: string;
  owner_payout_amount: string;
  commission_rate: string;
  status: BookingStatus;
  payment_status: "unpaid" | "simulated_paid";
  renter_note: string | null;
  cancellation_reason: string | null;
  thread_id: string | null;
  created_at: string;
};

export type BookingListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Booking[];
};

export type CalendarListing = {
  id: string;
  title: string;
  resource_type: string;
  bookings: {
    id: string;
    start_date: string;
    end_date: string;
    status: BookingStatus;
    renter_name: string;
    gross_amount: string;
  }[];
};

export const bookingsApi = {
  list: (filters: { status?: BookingStatus; listing_id?: string; page?: number } = {}) =>
    apiClient.get<BookingListResponse>("/bookings/", {
      query: filters as Record<string, string | number | boolean | undefined | null>,
    }),

  get: (id: string) => apiClient.get<Booking>(`/bookings/${id}/`),

  accept: (id: string) => apiClient.patch<Booking>(`/bookings/${id}/accept/`),

  decline: (id: string, reason?: string) =>
    apiClient.patch<Booking>(`/bookings/${id}/decline/`, { reason }),

  cancel: (id: string, reason?: string) =>
    apiClient.patch<Booking>(`/bookings/${id}/cancel/`, { reason }),

  pay: (id: string) => apiClient.patch<Booking>(`/bookings/${id}/pay/`),

  calendar: (start_date: string, end_date: string) =>
    apiClient.get<{
      success: true;
      start_date: string;
      end_date: string;
      listing_count: number;
      data: CalendarListing[];
    }>("/owner/bookings/calendar/", { query: { start_date, end_date } }),
};
```

---

## Step 2: TDS BookingRow component

**File: `src/components/tds/BookingRow.tsx`**

```typescript
import Link from "next/link";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { StatusDot } from "./StatusDot";
import { formatDateRange, formatNaira, formatRelativeTime } from "@/lib/format";
import type { Booking } from "@/lib/api/bookings";

const accentMap = {
  pending: "amber",
  confirmed: "signal",
  active: "forge",
  declined: "alert",
  cancelled: "alert",
  completed: null,
} as const;

export function BookingRow({ booking, href }: { booking: Booking; href?: string }) {
  const accent = accentMap[booking.status] ?? null;
  const inner = (
    <Card accent={accent} className="hover:bg-surface-high transition-colors duration-fast">
      <div className="flex items-start gap-3">
        <Avatar src={booking.renter_photo} name={booking.renter_name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-body font-semibold text-[14px] truncate">
              {booking.renter_name}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-secondary">
              <StatusDot status={booking.status} /> {booking.status}
            </span>
          </div>
          <div className="text-[13px] text-text-secondary truncate">{booking.listing_title}</div>
          <div className="flex items-baseline justify-between mt-1 font-mono text-[12px]">
            <span className="text-text-tertiary">
              {formatDateRange(booking.start_date, booking.end_date)}
            </span>
            <span className="text-forge-light">{formatNaira(booking.gross_amount)}</span>
          </div>
          <div className="font-mono text-[11px] text-text-tertiary mt-1">
            {formatRelativeTime(booking.created_at)}
          </div>
        </div>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
```

---

## Step 3: Bookings inbox page

**File: `src/app/(owner)/bookings/page.tsx`** (replace stub)

```typescript
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
```

---

## Step 4: Booking detail page

**File: `src/app/(owner)/bookings/[id]/page.tsx`**

```typescript
"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageSquare } from "lucide-react";
import { bookingsApi } from "@/lib/api/bookings";
import { QUERY_KEYS } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { Avatar } from "@/components/tds/Avatar";
import { Badge } from "@/components/tds/Badge";
import { StatusDot } from "@/components/tds/StatusDot";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { formatDateRange, formatNaira } from "@/lib/format";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: QUERY_KEYS.booking(id),
    queryFn: () => bookingsApi.get(id),
  });

  const onSuccess = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.booking(id) });

  const accept = useMutation({ mutationFn: () => bookingsApi.accept(id), onSuccess });
  const decline = useMutation({ mutationFn: () => bookingsApi.decline(id, reason), onSuccess: () => { onSuccess(); setDeclineOpen(false); setReason(""); } });
  const cancel = useMutation({ mutationFn: () => bookingsApi.cancel(id, reason), onSuccess: () => { onSuccess(); setCancelOpen(false); setReason(""); } });
  const pay = useMutation({ mutationFn: () => bookingsApi.pay(id), onSuccess });

  if (q.isLoading) return <Skeleton className="h-[500px]" />;
  if (!q.data) return null;
  const b = q.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Booking · ${b.status}`}
        title={b.listing_title}
        description={`Booking ID ${b.id.slice(0, 8)}`}
        actions={
          <>
            {b.status === "pending" ? (
              <>
                <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                  Accept
                </Button>
                <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
                  Decline
                </Button>
              </>
            ) : null}
            {b.status === "confirmed" && b.payment_status === "unpaid" ? (
              <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                Mark paid
              </Button>
            ) : null}
            {b.status === "pending" || b.status === "confirmed" ? (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            ) : null}
            {b.thread_id ? (
              <Button asChild variant="secondary">
                <Link href={`/messages/${b.thread_id}`}>
                  <MessageSquare size={16} strokeWidth={1.5} /> Message
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-5">
          <div className="flex items-center gap-3">
            <Avatar src={b.renter_photo} name={b.renter_name} size={48} />
            <div>
              <div className="font-body font-semibold text-[16px]">{b.renter_name}</div>
              <div className="font-mono text-[12px] text-text-tertiary">renter</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Dates</div>
              <div className="font-mono text-[15px] mt-1">
                {formatDateRange(b.start_date, b.end_date)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Duration</div>
              <div className="font-mono text-[15px] mt-1">{b.duration_type}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Status</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <StatusDot status={b.status} />
                <Badge tone="neutral">{b.status}</Badge>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Payment</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <Badge tone={b.payment_status === "simulated_paid" ? "success" : "neutral"}>
                  {b.payment_status === "simulated_paid" ? "Paid" : "Unpaid"}
                </Badge>
              </div>
            </div>
          </div>

          {b.renter_note ? (
            <div className="pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                Renter note
              </div>
              <p className="text-[14px] text-text-secondary mt-1 whitespace-pre-line">
                {b.renter_note}
              </p>
            </div>
          ) : null}

          {b.cancellation_reason ? (
            <div className="pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                Cancellation reason
              </div>
              <p className="text-[14px] text-alert-soft mt-1 whitespace-pre-line">
                {b.cancellation_reason}
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Earnings</div>
          <div className="font-mono text-[24px]">{formatNaira(b.owner_payout_amount)}</div>
          <div className="pt-3 border-t border-border space-y-2 font-mono text-[13px]">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Gross</span>
              <span>{formatNaira(b.gross_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">
                Commission ({Number(b.commission_rate).toFixed(0)}%)
              </span>
              <span className="text-alert-soft">−{formatNaira(b.commission_amount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-text-secondary">Your payout</span>
              <span className="text-forge-light">{formatNaira(b.owner_payout_amount)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Decline dialog */}
      <ReasonDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline this booking"
        description="The renter will be notified. You can include a short reason."
        reason={reason}
        setReason={setReason}
        confirmLabel="Decline"
        confirmTone="danger"
        onConfirm={() => decline.mutate()}
        pending={decline.isPending}
      />

      {/* Cancel dialog */}
      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this booking"
        description="Both you and the renter will be notified."
        reason={reason}
        setReason={setReason}
        confirmLabel="Cancel booking"
        confirmTone="danger"
        onConfirm={() => cancel.mutate()}
        pending={cancel.isPending}
      />
    </div>
  );
}

function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reason,
  setReason,
  confirmLabel,
  confirmTone,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  reason: string;
  setReason: (v: string) => void;
  confirmLabel: string;
  confirmTone: "danger" | "primary";
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-[440px] rounded-card border border-border bg-surface-elevated p-5 space-y-4">
          <Dialog.Title className="font-display uppercase text-[22px]">{title}</Dialog.Title>
          <Dialog.Description className="text-[13px] text-text-secondary">
            {description}
          </Dialog.Description>
          <Field id="reason" label="Reason (optional)">
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Dates conflict with maintenance."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Back</Button>
            </Dialog.Close>
            <Button variant={confirmTone} onClick={onConfirm} disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## Step 5: Calendar page

The backend returns up to 90 days of bookings grouped by listing. Render a horizontal **timeline per listing** for a one-month window (configurable). Each booking is a colored bar spanning its date range, colored by status, clickable.

**File: `src/app/(owner)/bookings/calendar/page.tsx`**

```typescript
"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays } from "date-fns";
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
          {/* Header row: dates */}
          <div className="grid" style={{ gridTemplateColumns: `200px repeat(${days}, minmax(28px, 1fr))` }}>
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

            {/* Rows */}
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
  row: { id: string; title: string; bookings: { id: string; start_date: string; end_date: string; status: string }[] };
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
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days}, minmax(28px, 1fr))` }}>
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
```

> The header row uses `grid-template-columns: 200px repeat(N, …)`. Each listing row's first cell is the listing title; the rest is a positioned-bar canvas. If the layout breaks at extreme widths, swap to a virtualised list — but for a 30-day window across a typical fleet it renders cleanly.

---

## Step 6: Wire dashboard pending requests to bookings detail

The dashboard already links pending requests to `/bookings/{id}`. With Wave 04 the detail page exists — verify the link works end-to-end.

---

## Step 7: Smoke test

Backend with: a pending booking, a confirmed-unpaid booking, an active booking, and at least one cancelled booking.

```bash
npm run dev
```

1. `/bookings` → Pending tab loads, shows the pending booking with amber-tinted left accent (via `BookingRow` accent map).
2. Switch tabs to Confirmed / Active / All — list updates.
3. Click a pending booking → detail page shows the renter, dates, financial breakdown with mono numbers, and Accept / Decline / Cancel buttons.
4. Click Accept → status flips to `confirmed`, "Mark paid" button appears, "Accept/Decline" disappears.
5. Click "Mark paid" → `payment_status` becomes `simulated_paid` and the badge updates.
6. Open another pending booking, click Decline, enter a reason, confirm → status flips to `declined`, dialog closes.
7. From a confirmed booking, click Cancel → reason dialog opens, submit, status flips to `cancelled` and shows the reason in red.
8. Click "Message" on a booking with a `thread_id` → routes to `/messages/{thread_id}` (404 until Wave 05).
9. `/bookings/calendar` → renders the current month, each listing row shows bars positioned by date range and colored by status. Click a bar → routes to the booking detail. Use prev/next arrows to navigate months — fetch retriggers.

---

## Step 8: Commit

```bash
git add owner-web/src
git commit -m "owner-web: bookings inbox + detail + calendar — Wave 04"
```

---

## Definition of Done

- [ ] `src/lib/api/bookings.ts` exposes `list`, `get`, `accept`, `decline`, `cancel`, `pay`, `calendar`
- [ ] `BookingRow` shows renter avatar, name, listing title, date range, gross amount, status badge and status dot; left border accent reflects status (amber/signal/forge/alert)
- [ ] `/bookings` tabs cover Pending, Confirmed, Active, Completed, Cancelled, All
- [ ] Empty tab shows the dispatch-voice empty state ("No requests waiting.")
- [ ] `/bookings/{id}` shows the renter card, dates, status, payment status badge, renter note (when present), cancellation reason (when present), and the financial breakdown (gross, commission, payout in mono)
- [ ] Accept / Decline / Cancel / Mark paid actions appear only for their valid statuses; declined and cancelled prompt a reason dialog
- [ ] Message button links to `/messages/{thread_id}` when present
- [ ] `/bookings/calendar` renders a horizontal-bar month timeline keyed by listing, with status-colored bars and a legend; prev/next month navigation refetches
- [ ] All numeric values render in IBM Plex Mono via `formatNaira` / formatted dates with en dash
- [ ] All copy follows TDS voice; no emoji, no exclamations
- [ ] `npm run typecheck` passes
- [ ] Git commit `owner-web: bookings inbox + detail + calendar — Wave 04` is made
