"use client";

// Supplier-side handover submission on P7 — the counterpart of the app's S11
// capture screen. ≥2 photos (07 §9 resize → presign → PUT), class-recipe
// reading (FSD §7.4: hour meter for plant, odometer for haulage) + condition
// notes folded into the record's `reading` JSON, then POST /hires/{id}/handovers.
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ApiError, bff, isAllowedPhotoType, putPresignedUpload } from "@/lib/api";
import { resizeImage } from "@/lib/image-resize";
import { useSubmitHandover } from "@/lib/queries";
import type { HireDetail, PresignResult } from "@/lib/types";

const MIN_PHOTOS = 2;

type Picked = { file: File; previewUrl: string };

export function SubmitHandoverDialog({
  hire,
  kind,
}: {
  hire: HireDetail;
  kind: "on_hire" | "off_hire";
}) {
  const submit = useSubmitHandover(hire.id);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [hourMeter, setHourMeter] = useState("");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wantsHourMeter = hire.asset_class === "plant_machinery";
  const wantsOdometer = hire.asset_class === "trucks_haulage";
  const kindLabel = kind === "on_hire" ? "on-hire" : "off-hire";

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => isAllowedPhotoType(f.type))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPicked((prev) => [...prev, ...next]);
  }

  function removeAt(i: number) {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function reset() {
    picked.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPicked([]);
    setHourMeter("");
    setOdometer("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const keys: string[] = [];
      for (const { file } of picked) {
        const blob = await resizeImage(file);
        const contentType = blob.type || "image/jpeg";
        const presign = await bff<PresignResult>("/media/presign", {
          method: "POST",
          body: JSON.stringify({ kind: "handover_photo", content_type: contentType, file_size: blob.size }),
        });
        await putPresignedUpload(presign.presigned_put_url, blob, contentType);
        keys.push(presign.key);
      }
      const reading: Record<string, unknown> = {};
      if (wantsHourMeter && hourMeter.trim()) reading.hour_meter = hourMeter.trim();
      if (wantsOdometer && odometer.trim()) reading.odometer = odometer.trim();
      if (notes.trim()) reading.notes = notes.trim();
      await submit.mutateAsync({ kind, photos: keys, reading });
      reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submission failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary">Submit {kindLabel} handover</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface-card p-s5 shadow-e2">
          <Dialog.Title className="font-display text-h3 text-text-primary">
            Submit the {kindLabel} handover
          </Dialog.Title>
          <Dialog.Description className="mt-s2 text-body-sm text-text-secondary">
            Photograph the asset&apos;s condition{wantsHourMeter ? " and hour meter" : wantsOdometer ? " and odometer" : ""} at
            handover — this record is your evidence if anything is disputed. At least {MIN_PHOTOS} photos.
          </Dialog.Description>

          <div className="mt-s4 flex flex-wrap gap-s2">
            {picked.map((p, i) => (
              <div key={p.previewUrl} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={p.previewUrl} alt="" className="size-20 rounded-sm border border-border-default object-cover" />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="Remove photo"
                  className="absolute -right-s1 -top-s1 grid size-s4 place-items-center rounded-full bg-ink-900 text-mono-sm text-paper-0"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="grid size-20 cursor-pointer place-items-center rounded-sm border border-dashed border-border-default text-h3 text-ink-500 hover:border-amber-500">
              +
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {wantsHourMeter ? (
            <label className="mt-s4 block text-body-sm text-text-secondary">
              Hour meter reading
              <input
                inputMode="decimal"
                value={hourMeter}
                onChange={(e) => setHourMeter(e.target.value)}
                className="mt-s1 w-full rounded-sm border border-border-default p-s3 font-mono text-body-sm outline-none"
                placeholder="e.g. 4021.5"
              />
            </label>
          ) : null}
          {wantsOdometer ? (
            <label className="mt-s4 block text-body-sm text-text-secondary">
              Odometer reading (km)
              <input
                inputMode="decimal"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="mt-s1 w-full rounded-sm border border-border-default p-s3 font-mono text-body-sm outline-none"
                placeholder="e.g. 182400"
              />
            </label>
          ) : null}
          <label className="mt-s4 block text-body-sm text-text-secondary">
            Condition notes
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-s1 w-full rounded-sm border border-border-default p-s3 text-body-sm outline-none"
              placeholder="Scratches, fuel level, attachments handed over…"
            />
          </label>

          {error ? (
            <Banner tone="danger" className="mt-s3">
              {error}
            </Banner>
          ) : null}

          <div className="mt-s4 flex justify-end gap-s2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button loading={busy} disabled={picked.length < MIN_PHOTOS} onClick={() => void handleSubmit()}>
              Submit handover
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
