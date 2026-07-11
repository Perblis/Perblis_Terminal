"use client";

// P7 · Hire Detail (8+4): status banner + lifecycle rail + listing snapshot +
// EventTimeline + HandoverRecords; side = LockedTerms supplier hero (D-014's
// one home) + hirer note + conversation slot (lands with 7D). The sticky
// action bar mirrors hires/state.py EXACTLY via legalSupplierActions.
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { EventTimeline, HoldToConfirm, LifecycleRail } from "@/components/hires/detail-parts";
import { HandoverEvidence } from "@/components/hires/handover-evidence";
import { SubmitHandoverDialog } from "@/components/hires/handover-submit";
import { LockedTerms } from "@/components/hires/locked-terms";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { CLASS_BY_VALUE } from "@/lib/asset-classes";
import { ApiError, mediaUrl } from "@/lib/api";
import { formatDateRange, legalSupplierActions, supplierStatusCopy } from "@/lib/hire-domain";
import { useConfirmHandover, useHandovers, useHire, useHireAction, useRefundPreview } from "@/lib/queries";

function DeadlineBanner({ hire }: { hire: { status: string; request_expires_at: string | null; payment_deadline: string | null } }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, []);
  const iso = hire.status === "requested" ? hire.request_expires_at : hire.status === "accepted" ? hire.payment_deadline : null;
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return (
    <Banner tone={ms < 30 * 60_000 ? "danger" : "warning"} className="mb-s4">
      {hire.status === "requested" ? "Respond within " : "The hirer must pay within "}
      <span className="font-mono font-medium">
        {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      {hire.status === "requested" ? " — expired requests count against your record." : " or the dates release automatically."}
    </Banner>
  );
}

export default function HireDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hire = useHire(id);
  const handovers = useHandovers(id);
  const action = useHireAction(id);
  const confirmHandover = useConfirmHandover(id);

  const [dialog, setDialog] = useState<null | "accept" | "decline" | "cancel" | "dispute">(null);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const refundPreview = useRefundPreview(id, dialog === "cancel" && hire.data?.status === "confirmed");

  if (hire.isPending) {
    return (
      <div className="flex flex-col gap-s4">
        <Skeleton className="h-s6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (hire.isError || !hire.data) {
    return <Banner tone="danger">Couldn&apos;t load this hire — it may not exist or isn&apos;t yours.</Banner>;
  }

  const h = hire.data;
  const meta = CLASS_BY_VALUE[h.asset_class];
  const Glyph = CLASS_GLYPHS[h.asset_class];
  const actions = legalSupplierActions(h.status);
  const acceptedEvent = h.events.find((e) => e.to_status === "accepted");
  // The record the supplier could file next: on-hire once Confirmed, off-hire
  // once On Hire — but never when a record of that kind already exists.
  const nextKind = h.status === "confirmed" ? "on_hire" : h.status === "on_hire" ? "off_hire" : null;
  const submitKind =
    nextKind && actions.includes("submit_handover") && !(handovers.data ?? []).some((rec) => rec.kind === nextKind)
      ? nextKind
      : null;

  async function run(kind: "accept" | "decline" | "cancel" | "dispute", body?: unknown) {
    setActionError(null);
    try {
      await action.mutateAsync({ action: kind, body });
      setDialog(null);
      setReason("");
      setAck(false);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  }

  return (
    <>
      <PageHeader
        title={h.listing_title}
        crumbs={[{ label: "Hires", href: "/hires" }, { label: `T-${h.id.slice(0, 4).toUpperCase()}` }]}
        action={<StatusBadge status={h.status} />}
      />

      <DeadlineBanner hire={h} />

      <div className="grid gap-s5 lg:grid-cols-12">
        {/* main (8) */}
        <div className="flex min-w-0 flex-col gap-s5 lg:col-span-8">
          <Card>
            <LifecycleRail status={h.status} />
            <p className="mt-s3 text-body-sm text-text-secondary">{supplierStatusCopy(h.status)}</p>
          </Card>

          <Card className="flex items-center gap-s4">
            {h.listing_photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic
              <img src={mediaUrl(h.listing_photo) ?? ""} alt="" className="size-s8 rounded-sm object-cover" />
            ) : (
              <span className={`grid size-s8 shrink-0 place-items-center rounded-sm ${meta.bg} ${meta.text}`}>
                <Glyph size={26} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/assets/${h.listing_id}`} className="font-medium text-text-primary hover:underline">
                {h.listing_title}
              </Link>
              <p className="font-mono text-mono-sm text-text-secondary">
                {formatDateRange(h.start_date, h.end_date, h.duration_days)}
              </p>
              <p className="text-caption text-ink-500">scheme: {h.scheme || "daily"}</p>
            </div>
          </Card>

          {h.hirer_note ? (
            <Card>
              <h2 className="mb-s2 font-display text-h3 text-text-primary">Hirer&apos;s note</h2>
              <p className="text-body-sm text-text-secondary">{h.hirer_note}</p>
            </Card>
          ) : null}

          {(handovers.data ?? []).length > 0 || submitKind ? (
            <Card>
              <div className="mb-s3 flex flex-wrap items-center justify-between gap-s3">
                <h2 className="font-display text-h3 text-text-primary">Handovers</h2>
                {submitKind ? <SubmitHandoverDialog hire={h} kind={submitKind} /> : null}
              </div>
              {(handovers.data ?? []).length > 0 ? (
                <ul className="flex flex-col gap-s3">
                  {(handovers.data ?? []).map((rec) => (
                    <HandoverEvidence
                      key={rec.id}
                      record={rec}
                      confirmSlot={
                        !rec.confirmed_at ? (
                          rec.submitted_by_role === "hirer" && actions.includes("confirm_handover") ? (
                            <HoldToConfirm
                              label="Hold to confirm"
                              disabled={confirmHandover.isPending}
                              onConfirm={() => void confirmHandover.mutateAsync(rec.id).catch(() => setActionError("Confirmation failed — if you submitted this handover, the hirer confirms it."))}
                            />
                          ) : rec.submitted_by_role === "supplier" ? (
                            <p className="text-caption text-text-secondary">Awaiting the hirer&apos;s confirmation.</p>
                          ) : null
                        ) : null
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-text-secondary">
                  No handover recorded yet — whoever is present at the {submitKind === "on_hire" ? "handover" : "return"} submits
                  it, and the other party confirms.
                </p>
              )}
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-s3 font-display text-h3 text-text-primary">Timeline</h2>
            <EventTimeline events={h.events} />
          </Card>
        </div>

        {/* side (4) */}
        <div className="flex flex-col gap-s5 lg:col-span-4">
          <LockedTerms hire={h} lockedAt={acceptedEvent?.created_at ?? null} />
          <Card>
            <h2 className="mb-s2 font-display text-h3 text-text-primary">Conversation</h2>
            <p className="text-body-sm text-text-secondary">
              The hire chat lands here with the Messages slice — for now, reply from your email
              notifications.
            </p>
          </Card>
        </div>
      </div>

      {actionError ? (
        <Banner tone="danger" className="mt-s4">
          {actionError}
        </Banner>
      ) : null}

      {/* sticky action bar — exactly the legal transitions */}
      {actions.filter((a) => a !== "confirm_handover" && a !== "submit_handover").length > 0 ? (
        <div className="sticky bottom-0 mt-s5 flex flex-wrap items-center justify-end gap-s3 border-t border-border-default bg-surface-page py-s3">
          {actions.includes("raise_issue") ? (
            <Button variant="secondary" onClick={() => setDialog("dispute")}>
              Raise issue
            </Button>
          ) : null}
          {actions.includes("cancel") ? (
            <Button variant="secondary" onClick={() => setDialog("cancel")}>
              Cancel hire
            </Button>
          ) : null}
          {actions.includes("decline") ? (
            <Button variant="secondary" onClick={() => setDialog("decline")}>
              Decline hire
            </Button>
          ) : null}
          {actions.includes("accept") ? <Button onClick={() => setDialog("accept")}>Accept hire</Button> : null}
        </div>
      ) : null}

      {/* dialogs */}
      <Dialog.Root open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface-card p-s5 shadow-e2">
            {dialog === "accept" ? (
              <>
                <Dialog.Title className="font-display text-h3 text-text-primary">Accept this hire?</Dialog.Title>
                <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                  Accepting locks the terms — <span className="font-mono">{h.hire_value_display}</span> hire value,{" "}
                  <span className="font-mono">{h.payout_amount_display}</span> to you. The hirer then has 4 hours to pay.
                </Dialog.Description>
                {(h.asset_class === "plant_machinery" || h.asset_class === "trucks_haulage") ? (
                  <label className="mt-s3 flex items-start gap-s2 text-body-sm text-text-secondary">
                    <input type="checkbox" className="mt-s1 size-s4 accent-amber-500" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                    <span>I confirm the {h.asset_class === "plant_machinery" ? "operator" : "driver"} arrangement listed will be honoured for these dates.</span>
                  </label>
                ) : null}
                <div className="mt-s4 flex justify-end gap-s2">
                  <Button variant="secondary" onClick={() => setDialog(null)}>Not yet</Button>
                  <Button
                    loading={action.isPending}
                    disabled={(h.asset_class === "plant_machinery" || h.asset_class === "trucks_haulage") && !ack}
                    onClick={() => void run("accept", { acknowledgments: ack ? { operator_or_driver: true } : {} })}
                  >
                    Accept hire
                  </Button>
                </div>
              </>
            ) : dialog === "decline" ? (
              <>
                <Dialog.Title className="font-display text-h3 text-text-primary">Decline this request</Dialog.Title>
                <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                  The hirer sees your reason word-for-word — keep it useful (&ldquo;booked those
                  dates&rdquo;, &ldquo;site too far&rdquo;).
                </Dialog.Description>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-s3 w-full rounded-sm border border-border-default p-s3 text-body-sm outline-none"
                  placeholder="Why are you declining?"
                />
                <div className="mt-s4 flex justify-end gap-s2">
                  <Button variant="secondary" onClick={() => setDialog(null)}>Keep request</Button>
                  <Button variant="destructive" disabled={!reason.trim()} loading={action.isPending} onClick={() => void run("decline", { reason })}>
                    Decline hire
                  </Button>
                </div>
              </>
            ) : dialog === "cancel" ? (
              <>
                <Dialog.Title className="font-display text-h3 text-text-primary">Cancel hire?</Dialog.Title>
                {h.status === "confirmed" ? (
                  refundPreview.isPending ? (
                    <Skeleton className="mt-s3 h-32 w-full" />
                  ) : refundPreview.data ? (
                    <div className="mt-s3 rounded-sm border border-border-default bg-surface-page p-s4 font-mono text-mono">
                      <p className="font-display text-overline uppercase tracking-[0.1em] text-ink-500">Refund manifest — §7.6</p>
                      <div className="mt-s2 flex justify-between py-s1 text-body-sm"><span className="font-sans text-text-secondary">Hire value</span><span>{refundPreview.data.hire_value_display}</span></div>
                      <div className="flex justify-between py-s1 text-body-sm"><span className="font-sans text-text-secondary">Refund to hirer</span><span>{refundPreview.data.amount_display}</span></div>
                      {refundPreview.data.withheld_day > 0 ? (
                        <div className="flex justify-between py-s1 text-body-sm"><span className="font-sans text-text-secondary">Withheld day (to you)</span><span>{refundPreview.data.withheld_day_display}</span></div>
                      ) : null}
                      <div className="mt-s1 flex justify-between border-t-2 border-border-structural pt-s2 text-body-sm font-medium"><span className="font-sans">Processing retained</span><span>{refundPreview.data.processing_display}</span></div>
                    </div>
                  ) : (
                    <Banner tone="warning" className="mt-s3">Couldn&apos;t fetch the refund figures — try again before confirming.</Banner>
                  )
                ) : (
                  <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                    Nothing has been paid yet — cancelling releases the request with no money movement.
                  </Dialog.Description>
                )}
                {refundPreview.data?.strike || h.status !== "requested" ? (
                  <p className="mt-s3 text-body-sm text-amber-900">
                    Supplier cancellations after acceptance earn a strike — three in 90 days pauses
                    your listings.
                  </p>
                ) : null}
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-s3 w-full rounded-sm border border-border-default p-s3 text-body-sm outline-none"
                  placeholder="Reason / evidence note (kept on the record)"
                />
                <div className="mt-s4 flex justify-end gap-s2">
                  <Button variant="secondary" onClick={() => setDialog(null)}>Keep hire</Button>
                  <Button
                    variant="destructive"
                    loading={action.isPending}
                    disabled={h.status === "confirmed" && !refundPreview.data}
                    onClick={() => void run("cancel", { reason })}
                  >
                    Cancel hire
                  </Button>
                </div>
              </>
            ) : dialog === "dispute" ? (
              <>
                <Dialog.Title className="font-display text-h3 text-text-primary">Raise an issue</Dialog.Title>
                <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                  This freezes the payout and brings Terminal Ops in. Say what happened — damage,
                  non-return, meter mismatch.
                </Dialog.Description>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-s3 w-full rounded-sm border border-border-default p-s3 text-body-sm outline-none"
                  placeholder="What happened?"
                />
                <div className="mt-s4 flex justify-end gap-s2">
                  <Button variant="secondary" onClick={() => setDialog(null)}>Back</Button>
                  <Button variant="destructive" disabled={!reason.trim()} loading={action.isPending} onClick={() => void run("dispute", { reason })}>
                    Raise issue
                  </Button>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
