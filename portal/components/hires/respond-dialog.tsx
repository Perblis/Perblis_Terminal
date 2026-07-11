"use client";

// Accept/decline straight from a request queue row (P2) — the same locked-
// terms + operator/driver acknowledgment semantics as P7's dialogs, so a
// supplier can clear their queue without leaving the dashboard.
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useHireAction } from "@/lib/queries";
import type { Hire } from "@/lib/types";

export function RespondDialog({
  hire,
  mode,
  onClose,
}: {
  hire: Hire;
  mode: "accept" | "decline" | null;
  onClose: () => void;
}) {
  const action = useHireAction(hire.id);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAck = hire.asset_class === "plant_machinery" || hire.asset_class === "trucks_haulage";

  async function run(kind: "accept" | "decline", body?: unknown) {
    setError(null);
    try {
      await action.mutateAsync({ action: kind, body });
      setReason("");
      setAck(false);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  }

  return (
    <Dialog.Root open={mode !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface-card p-s5 shadow-e2">
          {mode === "accept" ? (
            <>
              <Dialog.Title className="font-display text-h3 text-text-primary">Accept this hire?</Dialog.Title>
              <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                <span className="font-medium text-text-primary">{hire.listing_title}</span> — accepting locks the terms:{" "}
                <span className="font-mono">{hire.hire_value_display}</span> hire value
                {hire.payout_amount_display ? (
                  <>
                    , <span className="font-mono">{hire.payout_amount_display}</span> to you
                  </>
                ) : null}
                . The hirer then has 4 hours to pay.
              </Dialog.Description>
              {needsAck ? (
                <label className="mt-s3 flex items-start gap-s2 text-body-sm text-text-secondary">
                  <input type="checkbox" className="mt-s1 size-s4 accent-amber-500" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>
                    I confirm the {hire.asset_class === "plant_machinery" ? "operator" : "driver"} arrangement listed will be
                    honoured for these dates.
                  </span>
                </label>
              ) : null}
              {error ? <p className="mt-s3 text-body-sm text-text-danger">{error}</p> : null}
              <div className="mt-s4 flex justify-end gap-s2">
                <Button variant="secondary" onClick={onClose}>
                  Not yet
                </Button>
                <Button
                  loading={action.isPending}
                  disabled={needsAck && !ack}
                  onClick={() => void run("accept", { acknowledgments: ack ? { operator_or_driver: true } : {} })}
                >
                  Accept hire
                </Button>
              </div>
            </>
          ) : mode === "decline" ? (
            <>
              <Dialog.Title className="font-display text-h3 text-text-primary">Decline this request</Dialog.Title>
              <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
                The hirer sees your reason word-for-word — keep it useful (&ldquo;booked those dates&rdquo;, &ldquo;site too
                far&rdquo;).
              </Dialog.Description>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-s3 w-full rounded-sm border border-border-default p-s3 text-body-sm outline-none"
                placeholder="Why are you declining?"
              />
              {error ? <p className="mt-s3 text-body-sm text-text-danger">{error}</p> : null}
              <div className="mt-s4 flex justify-end gap-s2">
                <Button variant="secondary" onClick={onClose}>
                  Keep request
                </Button>
                <Button variant="destructive" disabled={!reason.trim()} loading={action.isPending} onClick={() => void run("decline", { reason })}>
                  Decline hire
                </Button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
