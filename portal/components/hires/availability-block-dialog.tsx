"use client";

// Block-dates dialog for the CalendarGantt (D-024). A block is a hard hold on
// the whole listing — accept/pay reject into it exactly like a fully-booked
// range — so the copy says so plainly. Removal is the companion dialog: click
// a striped block on the Gantt to open it.
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { useCreateAvailabilityBlock, useDeleteAvailabilityBlock } from "@/lib/queries";
import type { AvailabilityBlock, Listing } from "@/lib/types";

export function AvailabilityBlockDialog({
  open,
  listings,
  defaultListingId,
  onClose,
}: {
  open: boolean;
  listings: Listing[];
  defaultListingId?: string;
  onClose: () => void;
}) {
  const create = useCreateAvailabilityBlock();
  const [listingId, setListingId] = useState(defaultListingId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chosen = listingId || defaultListingId || listings[0]?.id || "";

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({
        listingId: chosen,
        start_date: startDate,
        end_date: endDate,
        reason,
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-card p-s5 shadow-e2">
          <Dialog.Title className="font-display text-h3 text-text-primary">Block dates</Dialog.Title>
          <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
            Blocked dates are a hard hold — new requests, accepts and payments into them are
            refused, exactly as if every unit were on hire. Existing hires are untouched.
          </Dialog.Description>

          <div className="mt-s4 flex flex-col gap-s3">
            <div className="flex flex-col gap-s1">
              <label htmlFor="block-listing" className="text-caption font-medium text-text-secondary">
                Asset
              </label>
              <select
                id="block-listing"
                value={chosen}
                onChange={(e) => setListingId(e.target.value)}
                className="h-10 rounded-sm border border-border-default bg-surface-card px-s3 text-body-sm text-text-primary"
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-s3">
              <TextField
                label="From"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <TextField
                label="To"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <TextField
              label="Reason (only you see this)"
              placeholder="Maintenance, off-platform hire…"
              maxLength={140}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error ? (
            <p className="mt-s3 text-body-sm text-text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-s4 flex justify-end gap-s2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!chosen || !startDate || !endDate || create.isPending}
            >
              {create.isPending ? "Blocking…" : "Block dates"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RemoveBlockDialog({
  block,
  listingTitle,
  onClose,
}: {
  block: AvailabilityBlock | null;
  listingTitle: string;
  onClose: () => void;
}) {
  const remove = useDeleteAvailabilityBlock();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!block) return;
    setError(null);
    try {
      await remove.mutateAsync(block.id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    }
  }

  return (
    <Dialog.Root open={block !== null} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-card p-s5 shadow-e2">
          <Dialog.Title className="font-display text-h3 text-text-primary">Blocked dates</Dialog.Title>
          {block ? (
            <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
              <span className="font-medium text-text-primary">{listingTitle}</span> —{" "}
              <span className="font-mono">
                {block.start_date} → {block.end_date}
              </span>
              {block.reason ? <> · {block.reason}</> : null}. Removing the block releases these
              dates back to hirers immediately.
            </Dialog.Description>
          ) : null}
          {error ? (
            <p className="mt-s3 text-body-sm text-text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-s4 flex justify-end gap-s2">
            <Button variant="ghost" onClick={onClose}>
              Keep block
            </Button>
            <Button onClick={() => void submit()} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Remove block"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
