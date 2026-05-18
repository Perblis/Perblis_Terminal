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
  const decline = useMutation({
    mutationFn: () => bookingsApi.decline(id, reason),
    onSuccess: () => {
      onSuccess();
      setDeclineOpen(false);
      setReason("");
    },
  });
  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(id, reason),
    onSuccess: () => {
      onSuccess();
      setCancelOpen(false);
      setReason("");
    },
  });
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
            <Avatar src={b.renter.profile_photo} name={b.renter.full_name} size={48} />
            <div>
              <div className="font-body font-semibold text-[16px]">{b.renter.full_name}</div>
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
                Commission ({b.commission_rate_label || `${(Number(b.commission_rate) * 100).toFixed(0)}%`})
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
