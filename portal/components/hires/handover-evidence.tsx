"use client";

// Handover evidence on P7 — the record a party is attesting to when they
// hold-to-confirm. Photos are private-bucket (D-025): the record carries
// short-lived presigned GETs in `photo_urls` (local-dev relative URLs ride
// the BFF; R2 presigned URLs pass through). Readings mirror the app's
// capture pad (hour_meter / odometer / notes per FSD §7.4).
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";

import { mediaUrl } from "@/lib/api";
import type { HandoverRecord } from "@/lib/types";

const READING_LABEL: Record<string, string> = {
  hour_meter: "Hour meter",
  odometer: "Odometer",
  notes: "Condition notes",
};

function readingEntries(reading: Record<string, unknown>): [string, string][] {
  return Object.entries(reading)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => [READING_LABEL[k] ?? k.replace(/_/g, " "), String(v)]);
}

export function HandoverEvidence({
  record,
  confirmSlot,
}: {
  record: HandoverRecord;
  confirmSlot?: ReactNode;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const readings = readingEntries(record.reading ?? {});
  const submittedBy = record.submitted_by_role === "supplier" ? "you" : "the hirer";

  return (
    <li className="rounded-sm border border-border-default p-s3">
      <div className="flex flex-wrap items-start justify-between gap-s3">
        <div>
          <p className="text-body-sm font-medium text-text-primary">
            {record.kind === "on_hire" ? "On-hire handover" : "Off-hire handover"}
          </p>
          <p className="font-mono text-mono-sm text-ink-500">
            Submitted by {submittedBy} ·{" "}
            {new Date(record.created_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {record.confirmed_at ? " · confirmed" : " · awaiting confirmation"}
          </p>
        </div>
        {confirmSlot}
      </div>

      {readings.length > 0 ? (
        <dl className="mt-s3 flex flex-col gap-s1">
          {readings.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-s3 text-body-sm">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="text-right font-mono text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {record.photos_purged_at !== null ? (
        <p className="mt-s3 text-body-sm text-text-secondary">
          Photos were removed 90 days after off-hire — readings and confirmations remain on
          record.
        </p>
      ) : record.photo_urls.length > 0 ? (
        <div className="mt-s3 flex flex-wrap gap-s2">
          {record.photo_urls.map((url, i) => (
            <button
              key={record.photos[i] ?? url}
              type="button"
              onClick={() => setLightbox(i)}
              className="overflow-hidden rounded-sm border border-border-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
              aria-label={`View handover photo ${i + 1} of ${record.photo_urls.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned URLs are runtime-dynamic */}
              <img src={mediaUrl(url) ?? ""} alt="" className="size-20 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-s3 text-body-sm text-text-secondary">No photos attached.</p>
      )}

      <Dialog.Root open={lightbox !== null} onOpenChange={(v) => !v && setLightbox(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/80" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 outline-none">
            <Dialog.Title className="sr-only">Handover photo</Dialog.Title>
            {lightbox !== null ? (
              <figure className="flex flex-col items-center gap-s3">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned URLs are runtime-dynamic */}
                <img
                  src={mediaUrl(record.photo_urls[lightbox]) ?? ""}
                  alt={`Handover photo ${lightbox + 1}`}
                  className="max-h-[75vh] w-auto max-w-full rounded-sm object-contain"
                />
                <figcaption className="flex items-center gap-s4 font-mono text-mono-sm text-paper-0">
                  <button
                    type="button"
                    className="px-s2 py-s1 disabled:opacity-40"
                    disabled={lightbox === 0}
                    onClick={() => setLightbox(lightbox - 1)}
                  >
                    ← Prev
                  </button>
                  <span>
                    {lightbox + 1} / {record.photo_urls.length}
                  </span>
                  <button
                    type="button"
                    className="px-s2 py-s1 disabled:opacity-40"
                    disabled={lightbox === record.photo_urls.length - 1}
                    onClick={() => setLightbox(lightbox + 1)}
                  >
                    Next →
                  </button>
                </figcaption>
              </figure>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  );
}
