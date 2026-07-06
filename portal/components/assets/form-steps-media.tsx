"use client";

// P4 steps ④–⑥: photos (07 §9 pipeline), location (yard chips first), review
// + publish gates (F9).
import { Camera, Check, MapPin, Monitor, Smartphone, Star, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { CLASS_BY_VALUE } from "@/lib/asset-classes";
import { ApiError, bff, mediaUrl } from "@/lib/api";
import { keys, useInvalidate, useMe, useSpecTemplate, useYards } from "@/lib/queries";
import type { AssetClass, Listing, PresignResult } from "@/lib/types";

import type { AssetDraft } from "./asset-form";
import { VerificationDialog } from "./verification-dialog";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="skeleton h-56 w-full rounded-sm" />,
});

// --- ④ Photos ---------------------------------------------------------------

type UploadState = { name: string; progress: number; error?: string };

/** 07 §9: client resize to ≤1920px JPEG before the presigned PUT. */
async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82),
    );
  } catch {
    return file; // resize is best-effort; the server enforces the 10MB cap
  }
}

function putWithProgress(url: string, body: Blob, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.send(body);
  });
}

export function PhotosStep({
  listing,
  onChanged,
}: {
  listing: Listing | null;
  onChanged: (l: Listing) => void;
}) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidate();

  if (!listing) {
    return <p className="text-body-sm text-text-secondary">Save the pricing step first — photos attach to the draft.</p>;
  }
  const photos = [...listing.photos].sort((a, b) => a.position - b.position);

  async function refresh() {
    const fresh = await bff<Listing>(`/listings/${listing!.id}`);
    onChanged(fresh);
    await invalidate(keys.listings);
  }

  async function uploadOne(file: File, slot: number) {
    const update = (patch: Partial<UploadState>) =>
      setUploads((u) => u.map((s, i) => (i === slot ? { ...s, ...patch } : s)));
    try {
      const blob = await resizeImage(file);
      const contentType = blob.type || "image/jpeg";
      const presign = await bff<PresignResult>("/media/presign", {
        method: "POST",
        body: JSON.stringify({ kind: "listing_photo", content_type: contentType, file_size: blob.size }),
      });
      // Local-dev presign URLs are API-relative; ride the BFF (R2 URLs pass through).
      const putUrl = mediaUrl(presign.presigned_put_url) ?? presign.presigned_put_url;
      await putWithProgress(putUrl, blob, contentType, (p) => update({ progress: p }));
      await bff(`/listings/${listing!.id}/photos`, {
        method: "POST",
        body: JSON.stringify({ r2_key: presign.key, is_cover: photos.length === 0 && slot === 0 }),
      });
      update({ progress: 1 });
      await refresh();
      setUploads((u) => u.filter((_, i) => i !== slot));
    } catch (e) {
      update({
        error:
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Upload failed. Retry.",
      });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = 10 - photos.length - uploads.length;
    const batch = Array.from(files).slice(0, Math.max(0, room));
    const start = uploads.length;
    setUploads((u) => [...u, ...batch.map((f) => ({ name: f.name, progress: 0 }))]);
    batch.forEach((file, i) => void uploadOne(file, start + i));
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const order = [...photos];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    await bff(`/listings/${listing!.id}/photos/order`, {
      method: "POST",
      body: JSON.stringify({
        items: order.map((p, i) => ({ id: p.id, position: i, is_cover: p.is_cover })),
      }),
    });
    await refresh();
  }

  async function setCover(id: string) {
    await bff(`/listings/${listing!.id}/photos/order`, {
      method: "POST",
      body: JSON.stringify({
        items: photos.map((p, i) => ({ id: p.id, position: i, is_cover: p.id === id })),
      }),
    });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-s4">
      <div>
        <h2 className="font-display text-h3 text-text-primary">Photos</h2>
        <p className="mt-s1 text-body-sm text-text-secondary">
          At least one to publish, up to ten. The first thing hirers judge — shoot in daylight,
          show the whole machine.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-s3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <figure
            key={photo.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) void reorder(dragIndex, i);
              setDragIndex(null);
            }}
            className="group relative aspect-[4/3] cursor-grab overflow-hidden rounded-sm border border-border-default bg-surface-sunken"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic */}
            <img src={mediaUrl(photo.url) ?? ""} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => void setCover(photo.id)}
              aria-label={photo.is_cover ? "Cover photo" : "Make cover photo"}
              className={`absolute left-s1 top-s1 grid size-s5 place-items-center rounded-pill ${
                photo.is_cover
                  ? "bg-amber-500 text-ink-900"
                  : "bg-ink-900/60 text-paper-0 opacity-0 transition-opacity group-hover:opacity-100"
              }`}
            >
              <Star size={13} fill={photo.is_cover ? "currentColor" : "none"} />
            </button>
          </figure>
        ))}
        {uploads.map((u, i) => (
          <div
            key={`${u.name}-${i}`}
            className="relative flex aspect-[4/3] flex-col items-center justify-center gap-s2 rounded-sm border border-dashed border-border-strong bg-surface-sunken p-s2"
          >
            {u.error ? (
              <>
                <p className="text-center text-caption text-text-danger">{u.error}</p>
                <button
                  type="button"
                  className="text-caption underline"
                  onClick={() => setUploads((list) => list.filter((_, j) => j !== i))}
                >
                  Dismiss
                </button>
              </>
            ) : (
              <>
                <div className="h-s1 w-4/5 overflow-hidden rounded-pill bg-ink-200">
                  <div
                    className="h-full bg-amber-500 transition-[width] duration-quick"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </div>
                <p className="max-w-full truncate text-caption text-ink-500">{u.name}</p>
              </>
            )}
          </div>
        ))}
        {photos.length + uploads.length < 10 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-s2 rounded-sm border border-dashed border-border-strong text-ink-500 hover:border-border-structural hover:text-text-primary"
          >
            <Camera size={22} aria-hidden />
            <span className="text-caption font-medium">Add photos</span>
          </button>
        ) : null}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-caption text-ink-500">Drag to reorder · star sets the cover.</p>
    </div>
  );
}

// --- ⑤ Location --------------------------------------------------------------

export function LocationStep({
  draft,
  set,
}: {
  draft: AssetDraft;
  set: <K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => void;
}) {
  const yards = useYards();
  const pin = draft.point ? ([draft.point.coordinates[0], draft.point.coordinates[1]] as [number, number]) : null;

  return (
    <div className="flex flex-col gap-s4">
      <h2 className="font-display text-h3 text-text-primary">Where does it live?</h2>
      {(yards.data ?? []).length > 0 ? (
        <div className="flex flex-col gap-s2">
          <span className="text-caption font-medium text-text-secondary">Your yards</span>
          <div className="flex flex-wrap gap-s2">
            {(yards.data ?? []).map((yard) => {
              const active = draft.yard_id === yard.id;
              return (
                <button
                  key={yard.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    set("yard_id", active ? null : yard.id);
                    if (!active) set("point", null);
                  }}
                  className={`flex items-center gap-s1 rounded-pill border px-s3 py-s2 text-body-sm ${
                    active
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-border-strong text-text-secondary hover:bg-ink-50"
                  }`}
                >
                  <MapPin size={14} aria-hidden />
                  {yard.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!draft.yard_id ? (
        <div className="flex flex-col gap-s2">
          <span className="text-caption font-medium text-text-secondary">
            {(yards.data ?? []).length > 0 ? "…or drop a new pin" : "Drop a pin"}
          </span>
          <MapView
            className="h-56 w-full overflow-hidden rounded-sm border border-border-default"
            center={pin ?? undefined}
            marker={pin}
            onPick={(lngLat) => set("point", { type: "Point", coordinates: lngLat })}
          />
          <p className="text-caption text-ink-500">
            Click the map or drag the pin to exactly where the asset sits. If several assets share
            this spot, make it a yard from the Yards page and they&apos;ll share one map pin.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// --- ⑥ Review + publish gates -------------------------------------------------

export function ReviewStep({
  draft,
  listing,
  onPublished,
  onSynced,
}: {
  draft: AssetDraft;
  listing: Listing | null;
  onPublished: () => void;
  onSynced: (l: Listing) => void;
}) {
  const me = useMe();
  const template = useSpecTemplate(draft.asset_class, draft.asset_type);
  const invalidate = useInvalidate();
  const [frame, setFrame] = useState<"phone" | "web">("phone");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [live, setLive] = useState(false);

  const requiredMissing = Object.entries(template.data?.fields ?? {}).filter(
    ([key, f]) => f.required && (draft.specs[key] === undefined || draft.specs[key] === ""),
  );

  const gates = [
    { label: "Required specs complete", ok: requiredMissing.length === 0 },
    { label: "At least one photo", ok: (listing?.photos.length ?? 0) >= 1 },
    { label: "Location set (yard or pin)", ok: Boolean(draft.yard_id || draft.point) },
    { label: "Account verified", ok: me.data?.is_verified ?? false, verify: true },
  ];
  const blocked = gates.filter((g) => !g.ok);

  async function publish() {
    if (!listing) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const updated = await bff<Listing>(`/listings/${listing.id}/publish`, { method: "POST" });
      onSynced(updated);
      await invalidate(keys.listings);
      setLive(true);
      window.setTimeout(onPublished, 1600); // let the Live beat land (08 §4)
    } catch (e) {
      setPublishError(e instanceof ApiError ? e.message : "Publish failed. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  const cover = listing?.photos.find((p) => p.is_cover) ?? listing?.photos[0];
  const clsMeta = draft.asset_class ? CLASS_BY_VALUE[draft.asset_class as AssetClass] : null;
  const Glyph = clsMeta ? CLASS_GLYPHS[clsMeta.value] : null;

  const previewCard = (
    <div className="overflow-hidden rounded-md border border-border-default bg-surface-card">
      <div className="relative aspect-[4/3] bg-surface-sunken">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic
          <img src={mediaUrl(cover.url) ?? ""} alt="" className="h-full w-full object-cover" />
        ) : clsMeta && Glyph ? (
          <div className={`flex h-full items-center justify-center ${clsMeta.bg} ${clsMeta.text}`}>
            <Glyph size={48} />
          </div>
        ) : null}
        {clsMeta ? (
          <span
            className={`absolute left-s2 top-s2 flex items-center gap-s1 rounded-pill px-s2 py-px text-caption font-medium ${clsMeta.bg} ${clsMeta.text}`}
          >
            <span className={`size-s2 rounded-pill ${clsMeta.dot}`} aria-hidden />
            {clsMeta.label}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-s1 p-s3">
        <p className="line-clamp-2 text-body font-medium text-text-primary">{draft.title || "Untitled"}</p>
        <p className="text-caption text-ink-500">{draft.asset_type}</p>
        <p className="pt-s1">
          <Money kobo={draft.daily_price ?? undefined} className="text-mono-lg" />
          <span className="text-caption text-ink-500"> /day</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-s5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h3 text-text-primary">Review — as hirers will see it</h2>
        <div className="flex gap-s1" role="group" aria-label="Preview frame">
          <button
            type="button"
            aria-pressed={frame === "phone"}
            onClick={() => setFrame("phone")}
            className={`rounded-sm p-s2 ${frame === "phone" ? "bg-ink-900 text-paper-0" : "text-ink-500 hover:bg-ink-100"}`}
          >
            <Smartphone size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-pressed={frame === "web"}
            onClick={() => setFrame("web")}
            className={`rounded-sm p-s2 ${frame === "web" ? "bg-ink-900 text-paper-0" : "text-ink-500 hover:bg-ink-100"}`}
          >
            <Monitor size={16} aria-hidden />
          </button>
        </div>
      </div>

      {frame === "phone" ? (
        <div className="mx-auto w-64 rounded-lg border-4 border-ink-900 bg-surface-page p-s2">{previewCard}</div>
      ) : (
        <div className="mx-auto w-full max-w-sm">{previewCard}</div>
      )}

      <div className="flex flex-col gap-s2">
        <h3 className="text-body font-medium text-text-primary">
          {blocked.length === 0 ? "Ready to go live" : `${blocked.length} thing${blocked.length > 1 ? "s" : ""} before this goes live:`}
        </h3>
        <ul className="flex flex-col gap-s1">
          {gates.map((gate) => (
            <li key={gate.label} className="flex items-center gap-s2 text-body-sm">
              {gate.ok ? (
                <Check size={16} className="text-green-600" aria-hidden />
              ) : (
                <X size={16} className="text-amber-900" aria-hidden />
              )}
              <span className={gate.ok ? "text-text-secondary" : "text-text-primary"}>{gate.label}</span>
              {!gate.ok && gate.verify ? (
                <Button size="sm" variant="secondary" onClick={() => setVerifyOpen(true)}>
                  Verify identity
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {publishError ? <Banner tone="danger">{publishError}</Banner> : null}

      {live ? (
        <div className="flex items-center gap-s3 rounded-sm border border-green-600 bg-green-50 p-s4">
          <span className="relative flex size-s3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-green-600 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-s3 rounded-pill bg-green-600" />
          </span>
          <p className="text-body font-medium text-green-900">Live. Your asset is now on the map.</p>
        </div>
      ) : (
        <Button size="lg" onClick={publish} disabled={blocked.length > 0 || !listing} loading={publishing}>
          Publish
        </Button>
      )}

      <VerificationDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </div>
  );
}
