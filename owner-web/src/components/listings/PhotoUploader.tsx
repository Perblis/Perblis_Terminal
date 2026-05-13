"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { listingsApi, type ListingMedia } from "@/lib/api/listings";
import { cn } from "@/lib/cn";
import { QUERY_KEYS } from "@/lib/constants";

type Pending = {
  tempId: string;
  file: File;
  progress: "queued" | "uploading" | "done" | "error";
  error?: string;
};

export function PhotoUploader({
  listingId,
  media,
  onChange,
}: {
  listingId: string;
  media: ListingMedia[];
  onChange?: () => void;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const del = useMutation({
    mutationFn: (media_id: string) => listingsApi.deleteMedia(listingId, media_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(listingId) });
      onChange?.();
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // If the listing has no photos yet, the very first uploaded file is
    // promoted to primary by the backend automatically (see listings/views.py).
    const noPhotosYet = media.length === 0 && pending.length === 0;

    const toQueue: Pending[] = Array.from(files).map((f, i) => ({
      tempId: `${Date.now()}-${i}-${f.name}`,
      file: f,
      progress: "queued",
    }));
    setPending((p) => [...p, ...toQueue]);

    let index = 0;
    for (const item of toQueue) {
      const isPrimary = noPhotosYet && index === 0;
      index += 1;
      setPending((p) =>
        p.map((q) => (q.tempId === item.tempId ? { ...q, progress: "uploading" } : q)),
      );
      try {
        await listingsApi.uploadMedia(listingId, item.file, isPrimary);
        setPending((p) =>
          p.map((q) => (q.tempId === item.tempId ? { ...q, progress: "done" } : q)),
        );
      } catch (err) {
        setPending((p) =>
          p.map((q) =>
            q.tempId === item.tempId
              ? {
                  ...q,
                  progress: "error",
                  error: (err as Error).message,
                }
              : q,
          ),
        );
      }
    }

    qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(listingId) });
    onChange?.();
    // Drop completed rows after a beat so the user sees the success state.
    setTimeout(() => setPending((p) => p.filter((q) => q.progress !== "done")), 1200);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-card border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-forge bg-forge-dim/30" : "border-border bg-surface",
        )}
      >
        <Upload
          size={20}
          strokeWidth={1.5}
          className="text-text-tertiary mx-auto mb-2"
          aria-hidden
        />
        <div className="text-text-primary mb-1 text-[14px]">Drop photos here</div>
        <div className="text-text-tertiary mb-3 text-[12px]">
          JPG or PNG. The first photo on an empty listing becomes the primary.
        </div>
        <label className="inline-block">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button asChild variant="secondary" size="sm">
            <span>Choose files</span>
          </Button>
        </label>
      </div>

      {pending.length > 0 ? (
        <ul className="space-y-1 font-mono text-[12px]">
          {pending.map((p) => (
            <li
              key={p.tempId}
              className={cn(
                "border-border bg-surface flex h-8 items-center justify-between rounded border px-3",
                p.progress === "error" && "border-l-alert border-l-[3px]",
                p.progress === "done" && "border-l-clear border-l-[3px]",
              )}
            >
              <span className="text-text-secondary truncate">{p.file.name}</span>
              <span
                className={cn(
                  "text-[11px] tracking-[0.06em] uppercase",
                  p.progress === "uploading" && "text-amber",
                  p.progress === "done" && "text-clear-soft",
                  p.progress === "error" && "text-alert-soft",
                  p.progress === "queued" && "text-text-tertiary",
                )}
              >
                {p.progress === "error" ? (p.error ?? "Failed") : p.progress}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {media.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-card border-border bg-surface relative aspect-[4/3] overflow-hidden border",
                m.is_primary && "border-l-forge border-l-[3px]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.file_url} alt="" className="h-full w-full object-cover" />
              {m.is_primary ? (
                <span className="bg-abyss/85 rounded-pill text-forge-light absolute top-2 left-2 inline-flex h-5 items-center gap-1 px-2 text-[10px] tracking-[0.06em] uppercase">
                  <Star size={12} strokeWidth={1.5} aria-hidden />
                  Primary
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => del.mutate(m.id)}
                disabled={del.isPending}
                className="bg-abyss/85 text-alert-soft hover:bg-alert/30 absolute top-2 right-2 grid h-7 w-7 place-items-center rounded disabled:opacity-40"
                aria-label="Delete photo"
              >
                <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
