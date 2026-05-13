# TERMINAL OWNER WEB — WAVE 03: LISTINGS

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 04 until the Definition of Done checklist is fully complete.

---

## Context

This wave delivers the full **listing management** surface for owners:

1. **Listings index** — filterable table/grid of the owner's listings, with bulk-select toolbar (activate / pause / archive).
2. **Listing detail** — preview of the public listing card, per-listing stats panel, edit + duplicate + status actions.
3. **Listing editor** (create + edit) — multi-section form: basics, location, pricing, specs, photos.
4. **Photo uploader** — drag-drop multi-file upload with progress, primary-photo toggle, reorder, delete. Backend takes **one file per request**, so the client uploads serially and surfaces per-file state.

### Backend endpoints used

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /api/v1/listings/` | GET | Owner's listings. Filters: `status`, `resource_type`, `city`, `is_available`, `min_price_daily`, `max_price_daily`, `created_after`, `created_before`. Ordering: `created_at`, `view_count`, `price_daily`, `title`. |
| `POST /api/v1/listings/` | POST | Create. Body: `resource_type`, `title`, `description`, `category`, `price_daily`, `price_weekly`, `price_monthly`, `specs`, `latitude`, `longitude`, `location_address`, `location_city`, `operator_available`, `delivery_available`. |
| `GET /api/v1/listings/{id}/` | GET | Detail. |
| `PUT/PATCH /api/v1/listings/{id}/` | PATCH | Edit. Same fields as create, partial allowed. |
| `DELETE /api/v1/listings/{id}/` | DELETE | Archive (sets `status='archived'`). |
| `PATCH /api/v1/listings/{id}/status/` | PATCH | Body: `{status: 'draft'|'active'|'paused'|'archived'}`. |
| `POST /api/v1/listings/{id}/media/` | POST | Multipart, **one file per request**. Form fields: `file`, optional `is_primary='true'`. |
| `DELETE /api/v1/listings/{id}/media/{media_id}/` | DELETE | Remove a photo. |
| `GET /api/v1/owner/listings/{id}/stats/` | GET | Per-listing analytics. |
| `POST /api/v1/owner/listings/{id}/duplicate/` | POST | Clone as draft. |
| `POST /api/v1/owner/listings/bulk/` | POST | Body: `{ids: string[], action: 'activate'|'pause'|'archive'}`. Activate enforces "has location + ≥1 photo" and returns `skipped` details if some listings fail. |

**Activation rules:** A listing must have a location AND at least one photo to move to `active`. Surface this clearly in the editor and bulk-action result.

---

## Step 1: Listings API module

**File: `src/lib/api/listings.ts`**

```typescript
import { apiClient } from "./client";
import type { ListingStatus, ResourceType } from "@/lib/constants";

export type ListingMedia = {
  id: string;
  file_url: string;
  is_primary: boolean;
  display_order?: number;
};

export type Listing = {
  id: string;
  owner_id: string;
  resource_type: ResourceType;
  title: string;
  description: string;
  category: string;
  price_daily: string | null;
  price_weekly: string | null;
  price_monthly: string | null;
  specs: Record<string, string | number | boolean>;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  location_city: string | null;
  status: ListingStatus;
  is_available: boolean;
  verification_tier: "basic" | "verified" | "inspected";
  view_count: number;
  operator_available: boolean;
  delivery_available: boolean;
  media: ListingMedia[];
  primary_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingFilters = {
  status?: ListingStatus;
  resource_type?: ResourceType;
  city?: string;
  is_available?: boolean;
  min_price_daily?: number;
  max_price_daily?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export type ListingListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Listing[];
};

export type ListingCreatePayload = {
  resource_type: ResourceType;
  title: string;
  description: string;
  category?: string;
  price_daily?: number | string;
  price_weekly?: number | string;
  price_monthly?: number | string;
  specs?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  location_city?: string;
  operator_available?: boolean;
  delivery_available?: boolean;
};

export type ListingStats = {
  listing_id: string;
  view_count: number;
  inquiry_count: number;
  booking_request_count: number;
  confirmed_booking_count: number;
  conversion_rate: number;
  occupancy_rate_90d: number;
  total_gross_revenue: string;
  total_payout: string;
};

export type BulkActionResult = {
  success: true;
  message?: string;
  updated_count?: number;
  activated?: string[];
  skipped?: string[];
  skipped_reason?: Record<string, string>;
  skipped_listings?: { id: string; reason: string }[];
};

export const listingsApi = {
  list: (filters: ListingFilters = {}) =>
    apiClient.get<ListingListResponse>("/listings/", { query: filters as Record<string, string | number | boolean | undefined | null> }),

  get: (id: string) => apiClient.get<Listing>(`/listings/${id}/`),

  create: (body: ListingCreatePayload) => apiClient.post<Listing>("/listings/", body),

  patch: (id: string, body: Partial<ListingCreatePayload>) =>
    apiClient.patch<Listing>(`/listings/${id}/`, body),

  setStatus: (id: string, status: ListingStatus) =>
    apiClient.patch<Listing>(`/listings/${id}/status/`, { status }),

  archive: (id: string) => apiClient.delete<{ success: true }>(`/listings/${id}/`),

  uploadMedia: (id: string, file: File, is_primary = false) => {
    const fd = new FormData();
    fd.append("file", file);
    if (is_primary) fd.append("is_primary", "true");
    return apiClient.upload<{ success: true; data: ListingMedia }>(
      `/listings/${id}/media/`,
      fd,
    );
  },

  deleteMedia: (listing_id: string, media_id: string) =>
    apiClient.delete<{ success: true }>(`/listings/${listing_id}/media/${media_id}/`),

  stats: (id: string) =>
    apiClient.get<{ success: true; data: ListingStats }>(`/owner/listings/${id}/stats/`),

  duplicate: (id: string) =>
    apiClient.post<{ success: true; data: Listing; message?: string }>(
      `/owner/listings/${id}/duplicate/`,
    ),

  bulk: (ids: string[], action: "activate" | "pause" | "archive") =>
    apiClient.post<BulkActionResult>("/owner/listings/bulk/", { ids, action }),
};
```

---

## Step 2: TDS ListingCard component

**File: `src/components/tds/ListingCard.tsx`**

```typescript
import Link from "next/link";
import { Card } from "./Card";
import { ResourceIcon } from "./ResourceIcon";
import { StatusDot } from "./StatusDot";
import { Badge } from "./Badge";
import { formatNaira } from "@/lib/format";
import type { Listing } from "@/lib/api/listings";
import { cn } from "@/lib/cn";

export function ListingCard({ listing, selectable, selected, onSelect }: {
  listing: Listing;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, next: boolean) => void;
}) {
  const status = listing.status;
  const statusTone =
    status === "active"
      ? "success"
      : status === "paused"
        ? "warn"
        : status === "archived"
          ? "neutral"
          : "neutral";

  return (
    <Card className={cn("p-0 overflow-hidden", selected && "ring-1 ring-forge")}>
      <div className="relative h-[156px] bg-surface-elevated">
        {listing.primary_photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.primary_photo_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <ResourceIcon
              type={listing.resource_type}
              size={56}
              className="text-text-tertiary opacity-60"
            />
          </div>
        )}
        {selectable ? (
          <label className="absolute top-2 left-2 inline-flex items-center justify-center w-6 h-6 rounded bg-abyss/80 border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelect?.(listing.id, e.target.checked)}
              className="appearance-none w-3 h-3 rounded-sm border border-text-secondary checked:bg-forge checked:border-forge"
            />
          </label>
        ) : null}
        <span className="absolute top-2 right-2 px-2 h-5 inline-flex items-center rounded-pill bg-abyss/85 border border-border text-[11px] uppercase tracking-[0.06em] text-text-secondary">
          {listing.resource_type}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/listings/${listing.id}`} className="block min-w-0">
            <div className="font-body font-semibold text-[14px] truncate">{listing.title}</div>
            <div className="font-body text-[12px] text-text-tertiary truncate">
              {listing.location_city ?? "No location"}
            </div>
          </Link>
          <Badge tone={statusTone as "success" | "warn" | "neutral"}>
            <StatusDot status={status} className="mr-1.5" /> {status}
          </Badge>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[15px] text-text-primary">
            {formatNaira(listing.price_daily)}
            <span className="text-[11px] text-text-tertiary"> /day</span>
          </span>
          <span className="font-mono text-[11px] text-text-tertiary">
            {listing.view_count} views
          </span>
        </div>
      </div>
    </Card>
  );
}
```

---

## Step 3: Listings index page

**File: `src/app/(owner)/listings/page.tsx`** (replace Wave 02 stub)

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListingCard } from "@/components/tds/ListingCard";
import { EmptyState } from "@/components/tds/EmptyState";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { listingsApi, type ListingFilters } from "@/lib/api/listings";
import {
  LISTING_STATUSES,
  RESOURCE_TYPES,
  QUERY_KEYS,
  type ListingStatus,
  type ResourceType,
} from "@/lib/constants";

export default function ListingsIndexPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ListingFilters>({ page: 1, page_size: 24 });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: QUERY_KEYS.listings(filters),
    queryFn: () => listingsApi.list(filters),
  });

  const bulk = useMutation({
    mutationFn: (action: "activate" | "pause" | "archive") =>
      listingsApi.bulk(Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });

  const hasSelection = selected.size > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Your fleet."
        actions={
          <Button asChild>
            <Link href="/listings/new">
              <Plus size={16} strokeWidth={1.5} /> New listing
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
            Status
          </label>
          <select
            value={filters.status ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, page: 1, status: (e.target.value || undefined) as ListingStatus | undefined })
            }
            className="h-10 rounded border border-border bg-surface-elevated px-3 text-[14px]"
          >
            <option value="">All</option>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
            Resource
          </label>
          <select
            value={filters.resource_type ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, page: 1, resource_type: (e.target.value || undefined) as ResourceType | undefined })
            }
            className="h-10 rounded border border-border bg-surface-elevated px-3 text-[14px]"
          >
            <option value="">All</option>
            {RESOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
            City
          </label>
          <Input
            placeholder="Lagos"
            value={filters.city ?? ""}
            onChange={(e) => setFilters({ ...filters, page: 1, city: e.target.value || undefined })}
            className="w-[180px]"
          />
        </div>
      </div>

      {/* Bulk toolbar */}
      {hasSelection ? (
        <div className="sticky top-14 z-10 -mx-5 lg:-mx-8 px-5 lg:px-8 py-3 bg-surface-elevated border-y border-border flex items-center gap-3">
          <span className="font-mono text-[13px] text-text-primary">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => bulk.mutate("activate")} disabled={bulk.isPending}>
            Activate
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulk.mutate("pause")} disabled={bulk.isPending}>
            Pause
          </Button>
          <Button variant="danger" size="sm" onClick={() => bulk.mutate("archive")} disabled={bulk.isPending}>
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {bulk.data?.skipped_listings && bulk.data.skipped_listings.length > 0 ? (
        <div className="rounded-card border border-amber-dim bg-amber-dim/40 p-4">
          <div className="text-[13px] text-amber font-medium uppercase tracking-[0.04em] mb-2">
            {bulk.data.skipped_listings.length} skipped
          </div>
          <ul className="space-y-1 font-mono text-[12px] text-text-secondary">
            {bulk.data.skipped_listings.map((s) => (
              <li key={s.id}>
                {s.id.slice(0, 8)} — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Grid */}
      {q.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px]" />
          ))}
        </div>
      ) : q.data && q.data.results.length === 0 ? (
        <EmptyState
          title="No listings yet."
          hint="Add your first asset to start receiving requests."
          cta={{ label: "New listing", href: "/listings/new" }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {q.data!.results.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              selectable
              selected={selected.has(l.id)}
              onSelect={toggle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {q.data && q.data.count > (filters.page_size ?? 24) ? (
        <div className="flex items-center justify-between font-mono text-[12px] text-text-secondary">
          <span>{q.data.count} total</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!q.data.previous}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!q.data.next}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

---

## Step 4: Photo uploader component

**File: `src/components/listings/PhotoUploader.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2, Upload } from "lucide-react";
import { listingsApi, type ListingMedia } from "@/lib/api/listings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

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
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => listingsApi.uploadMedia(listingId, file),
  });

  const del = useMutation({
    mutationFn: (media_id: string) => listingsApi.deleteMedia(listingId, media_id),
  });

  const setPrimary = useMutation({
    mutationFn: async ({ file, mediaId }: { file?: never; mediaId: string }) => {
      // Re-upload not needed — toggling primary requires uploading a new file with is_primary=true
      // OR a backend endpoint that doesn't exist yet. For now, the only way to set a primary that
      // isn't already primary is to upload a new file with the flag. We expose this as "Set primary"
      // by sending a PATCH-like workaround: delete + re-upload is destructive, so we surface a
      // user-friendly message instead. (See backend WAVE_05_PART2 §"is_primary" for the policy.)
      throw new Error("Primary photo is set at upload time. Re-upload the photo to make it primary.");
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const toQueue: Pending[] = Array.from(files).map((f, i) => ({
      tempId: `${Date.now()}-${i}`,
      file: f,
      progress: "queued",
    }));
    setPending((p) => [...p, ...toQueue]);

    for (const item of toQueue) {
      setPending((p) =>
        p.map((q) => (q.tempId === item.tempId ? { ...q, progress: "uploading" } : q)),
      );
      try {
        await upload.mutateAsync(item.file);
        setPending((p) =>
          p.map((q) => (q.tempId === item.tempId ? { ...q, progress: "done" } : q)),
        );
      } catch (err) {
        setPending((p) =>
          p.map((q) =>
            q.tempId === item.tempId
              ? { ...q, progress: "error", error: (err as Error).message }
              : q,
          ),
        );
      }
    }
    qc.invalidateQueries({ queryKey: ["listing", listingId] });
    setTimeout(() => setPending((p) => p.filter((q) => q.progress !== "done")), 1000);
    onChange();
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
          "rounded-card border border-dashed p-6 text-center",
          dragOver ? "border-forge bg-forge-dim/30" : "border-border bg-surface",
        )}
      >
        <Upload size={20} strokeWidth={1.5} className="mx-auto text-text-tertiary mb-2" />
        <div className="text-[14px] text-text-primary mb-1">Drop photos here</div>
        <div className="text-[12px] text-text-tertiary mb-3">
          JPG or PNG. The first photo becomes the primary.
        </div>
        <label className="inline-block">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button asChild variant="secondary" size="sm">
            <span>Choose files</span>
          </Button>
        </label>
      </div>

      {/* In-flight queue */}
      {pending.length > 0 ? (
        <ul className="space-y-1 font-mono text-[12px]">
          {pending.map((p) => (
            <li
              key={p.tempId}
              className={cn(
                "px-3 h-8 flex items-center justify-between rounded border border-border bg-surface",
                p.progress === "error" && "border-l-[3px] border-l-alert",
                p.progress === "done" && "border-l-[3px] border-l-clear",
              )}
            >
              <span className="truncate text-text-secondary">{p.file.name}</span>
              <span className={cn(
                "uppercase tracking-[0.06em] text-[11px]",
                p.progress === "uploading" && "text-amber",
                p.progress === "done" && "text-clear-soft",
                p.progress === "error" && "text-alert-soft",
                p.progress === "queued" && "text-text-tertiary",
              )}>
                {p.progress === "error" ? p.error ?? "Failed" : p.progress}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Existing photos */}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((m) => (
            <div
              key={m.id}
              className={cn(
                "relative rounded-card overflow-hidden border border-border bg-surface aspect-[4/3]",
                m.is_primary && "border-l-[3px] border-l-forge",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.file_url} alt="" className="w-full h-full object-cover" />
              {m.is_primary ? (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 h-5 rounded-pill bg-abyss/85 text-[10px] uppercase tracking-[0.06em] text-forge-light">
                  <Star size={12} strokeWidth={1.5} /> Primary
                </span>
              ) : null}
              <button
                onClick={() => del.mutate(m.id, { onSuccess: () => qc.invalidateQueries({ queryKey: ["listing", listingId] }) })}
                className="absolute top-2 right-2 w-7 h-7 rounded grid place-items-center bg-abyss/85 text-alert-soft hover:bg-alert/30"
                aria-label="Delete photo"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

> **Primary photo policy:** the backend assigns primary at upload time (first upload becomes primary; passing `is_primary=true` resets the previous primary). There is no PATCH for an existing photo's primary flag. The uploader honors this — to change the primary, delete and re-upload with `is_primary=true`. Update this component when the backend exposes a direct toggle.

---

## Step 5: Listing form (create + edit)

**File: `src/components/listings/ListingForm.tsx`**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/constants";

const schema = z.object({
  resource_type: z.enum(RESOURCE_TYPES),
  title: z.string().min(3, "Required."),
  description: z.string().min(20, "Describe the asset — 20 characters minimum."),
  category: z.string().optional(),
  price_daily: z.coerce.number().min(0).optional(),
  price_weekly: z.coerce.number().min(0).optional(),
  price_monthly: z.coerce.number().min(0).optional(),
  location_address: z.string().optional(),
  location_city: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  operator_available: z.boolean().optional(),
  delivery_available: z.boolean().optional(),
});

export type ListingFormValues = z.infer<typeof schema>;

export function ListingForm({
  defaults,
  submitting,
  submitLabel,
  onSubmit,
}: {
  defaults?: Partial<ListingFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: ListingFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_type: (defaults?.resource_type as ResourceType) ?? "equipment",
      operator_available: false,
      delivery_available: false,
      ...defaults,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-[720px]">
      {/* Basics */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Basics</h2>
        <Field id="resource_type" label="Resource type" error={errors.resource_type?.message}>
          <select
            id="resource_type"
            className="h-10 w-full rounded border border-border bg-surface-elevated px-3 text-[14px]"
            {...register("resource_type")}
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field id="title" label="Title" error={errors.title?.message}>
          <Input id="title" invalid={!!errors.title} {...register("title")} />
        </Field>

        <Field id="description" label="Description" error={errors.description?.message}>
          <textarea
            id="description"
            rows={6}
            className="w-full rounded border border-border bg-surface-elevated p-3 text-[14px] font-body"
            {...register("description")}
          />
        </Field>

        <Field id="category" label="Category" hint="Free text e.g. 'mobile crane', 'flatbed 30t'.">
          <Input id="category" {...register("category")} />
        </Field>
      </section>

      {/* Pricing */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Pricing</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field id="price_daily" label="Daily (₦)">
            <Input
              id="price_daily"
              inputMode="numeric"
              className="font-mono"
              {...register("price_daily")}
            />
          </Field>
          <Field id="price_weekly" label="Weekly (₦)">
            <Input
              id="price_weekly"
              inputMode="numeric"
              className="font-mono"
              {...register("price_weekly")}
            />
          </Field>
          <Field id="price_monthly" label="Monthly (₦)">
            <Input
              id="price_monthly"
              inputMode="numeric"
              className="font-mono"
              {...register("price_monthly")}
            />
          </Field>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Location</h2>
        <p className="text-[12px] text-text-tertiary">
          Location is required to activate the listing.
        </p>
        <Field id="location_address" label="Address">
          <Input id="location_address" {...register("location_address")} />
        </Field>
        <Field id="location_city" label="City">
          <Input id="location_city" {...register("location_city")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="latitude" label="Latitude">
            <Input id="latitude" inputMode="decimal" className="font-mono" {...register("latitude")} />
          </Field>
          <Field id="longitude" label="Longitude">
            <Input id="longitude" inputMode="decimal" className="font-mono" {...register("longitude")} />
          </Field>
        </div>
      </section>

      {/* Options */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Options</h2>
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" {...register("operator_available")} /> Operator can be provided
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" {...register("delivery_available")} /> Delivery available
        </label>
      </section>

      <div className="pt-2">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

> Mapbox integration for the lat/lng picker is wired in Wave 06 when we have the token plumbing for analytics maps. For now, free-text coordinates are accepted.

---

## Step 6: Create page

**File: `src/app/(owner)/listings/new/page.tsx`**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { listingsApi } from "@/lib/api/listings";

export default function NewListingPage() {
  const router = useRouter();
  const create = useMutation({
    mutationFn: (v: Parameters<typeof listingsApi.create>[0]) => listingsApi.create(v),
    onSuccess: (listing) => router.replace(`/listings/${listing.id}/edit`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New listing"
        title="Add asset"
        description="Save a draft, then upload photos and activate."
      />
      <ListingForm
        submitting={create.isPending}
        submitLabel="Save draft"
        onSubmit={(v) => create.mutate(v as Parameters<typeof listingsApi.create>[0])}
      />
      {create.error ? (
        <p className="text-[13px] text-alert-soft">{(create.error as Error).message}</p>
      ) : null}
    </div>
  );
}
```

---

## Step 7: Edit page

**File: `src/app/(owner)/listings/[id]/edit/page.tsx`**

```typescript
"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { PhotoUploader } from "@/components/listings/PhotoUploader";
import { Button } from "@/components/ui/Button";
import { listingsApi } from "@/lib/api/listings";
import { QUERY_KEYS } from "@/lib/constants";
import { Skeleton } from "@/components/tds/LoadingSkeleton";

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.listing(id),
    queryFn: () => listingsApi.get(id),
  });

  const patch = useMutation({
    mutationFn: (v: Parameters<typeof listingsApi.patch>[1]) => listingsApi.patch(id, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) }),
  });

  const setStatus = useMutation({
    mutationFn: (status: "active" | "paused" | "archived" | "draft") =>
      listingsApi.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) }),
  });

  if (q.isLoading) return <Skeleton className="h-[600px]" />;
  if (!q.data) return null;

  const l = q.data;
  const canActivate =
    !!l.latitude && !!l.longitude && (l.media?.length ?? 0) > 0 && l.status !== "active";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Listing · ${l.status}`}
        title={l.title}
        actions={
          <>
            {l.status !== "active" && canActivate ? (
              <Button onClick={() => setStatus.mutate("active")} disabled={setStatus.isPending}>
                Activate
              </Button>
            ) : null}
            {l.status === "active" ? (
              <Button variant="secondary" onClick={() => setStatus.mutate("paused")}>
                Pause
              </Button>
            ) : null}
            {l.status !== "archived" ? (
              <Button variant="danger" onClick={() => setStatus.mutate("archived")}>
                Archive
              </Button>
            ) : null}
          </>
        }
      />

      {!canActivate && l.status !== "active" ? (
        <div className="rounded-card border border-amber-dim bg-amber-dim/40 p-4 text-[13px] text-amber">
          Add a location and at least one photo before activating.
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Photos</h2>
        <PhotoUploader
          listingId={id}
          media={l.media ?? []}
          onChange={() => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em]">Details</h2>
        <ListingForm
          defaults={{
            resource_type: l.resource_type,
            title: l.title,
            description: l.description,
            category: l.category,
            price_daily: l.price_daily ? Number(l.price_daily) : undefined,
            price_weekly: l.price_weekly ? Number(l.price_weekly) : undefined,
            price_monthly: l.price_monthly ? Number(l.price_monthly) : undefined,
            location_address: l.location_address ?? undefined,
            location_city: l.location_city ?? undefined,
            latitude: l.latitude ?? undefined,
            longitude: l.longitude ?? undefined,
            operator_available: l.operator_available,
            delivery_available: l.delivery_available,
          }}
          submitting={patch.isPending}
          submitLabel="Save"
          onSubmit={(v) => patch.mutate(v as Parameters<typeof listingsApi.patch>[1])}
        />
      </section>
    </div>
  );
}
```

---

## Step 8: Listing detail page (read-only preview + stats)

**File: `src/app/(owner)/listings/[id]/page.tsx`**

```typescript
"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Edit3 } from "lucide-react";
import { listingsApi } from "@/lib/api/listings";
import { QUERY_KEYS } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/tds/Card";
import { KpiCard } from "@/components/tds/KpiCard";
import { Badge } from "@/components/tds/Badge";
import { StatusDot } from "@/components/tds/StatusDot";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { ResourceIcon } from "@/components/tds/ResourceIcon";
import { formatNaira } from "@/lib/format";
import { useRouter } from "next/navigation";

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const listing = useQuery({
    queryKey: QUERY_KEYS.listing(id),
    queryFn: () => listingsApi.get(id),
  });

  const stats = useQuery({
    queryKey: QUERY_KEYS.listingStats(id),
    queryFn: () => listingsApi.stats(id).then((r) => r.data),
  });

  const dup = useMutation({
    mutationFn: () => listingsApi.duplicate(id),
    onSuccess: (res) => router.replace(`/listings/${res.data.id}/edit`),
  });

  if (listing.isLoading) return <Skeleton className="h-[600px]" />;
  if (!listing.data) return null;
  const l = listing.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Listing · ${l.status}`}
        title={l.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => dup.mutate()} disabled={dup.isPending}>
              <Copy size={16} strokeWidth={1.5} /> Duplicate
            </Button>
            <Button asChild>
              <Link href={`/listings/${id}/edit`}>
                <Edit3 size={16} strokeWidth={1.5} /> Edit
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-card overflow-hidden border border-border bg-surface aspect-[16/9]">
            {l.primary_photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={l.primary_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <ResourceIcon
                  type={l.resource_type}
                  size={80}
                  className="text-text-tertiary opacity-60"
                />
              </div>
            )}
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="neutral">
                <StatusDot status={l.status} className="mr-1.5" /> {l.status}
              </Badge>
              <Badge tone="neutral">{l.resource_type}</Badge>
              {l.location_city ? <Badge tone="neutral">{l.location_city}</Badge> : null}
            </div>
            <p className="text-[14px] text-text-secondary whitespace-pre-line">{l.description}</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                Pricing
              </div>
              <div className="font-mono text-[20px]">
                {formatNaira(l.price_daily)} <span className="text-[12px] text-text-tertiary">/day</span>
              </div>
              {l.price_weekly ? (
                <div className="font-mono text-[13px] text-text-secondary">
                  {formatNaira(l.price_weekly)} /week
                </div>
              ) : null}
              {l.price_monthly ? (
                <div className="font-mono text-[13px] text-text-secondary">
                  {formatNaira(l.price_monthly)} /mo
                </div>
              ) : null}
            </div>
          </Card>

          {stats.data ? (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Views" value={String(stats.data.view_count)} />
              <KpiCard label="Inquiries" value={String(stats.data.inquiry_count)} />
              <KpiCard label="Requests" value={String(stats.data.booking_request_count)} />
              <KpiCard label="Confirmed" value={String(stats.data.confirmed_booking_count)} />
              <KpiCard
                label="Conv. rate"
                value={`${stats.data.conversion_rate.toFixed(1)}%`}
              />
              <KpiCard
                label="Occupancy 90d"
                value={`${stats.data.occupancy_rate_90d.toFixed(1)}%`}
              />
              <KpiCard
                label="Gross revenue"
                value={formatNaira(stats.data.total_gross_revenue)}
                className="col-span-2"
              />
            </div>
          ) : (
            <Skeleton className="h-[200px]" />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 9: Smoke test

Backend must have an owner account with at least 3 listings in mixed statuses, at least 1 with photos and location, and 1 listing eligible for activation.

```bash
npm run dev
```

1. `/listings` renders 3 cards in a responsive grid. Status badge appears with the correct color dot.
2. Filter by status → list re-fetches.
3. Select 2 listings → bulk toolbar appears with `2 selected`. Click "Pause" → both move to paused, toolbar clears.
4. Bulk "Activate" on a draft without a photo → returns `skipped` info, surfaces the amber notice with reasons.
5. `/listings/new` → form validates, saves a draft, redirects to `/listings/{id}/edit`.
6. Upload 3 photos via drag-drop. They appear with the first one marked **Primary** (3px left border). Delete one.
7. Form re-edit → fields hydrate from `defaults`, save updates.
8. `/listings/{id}` → renders read-only preview with hero photo, pricing card, stats panel.
9. Duplicate → routes to a new draft in the editor.

---

## Step 10: Commit

```bash
git add owner-web/src
git commit -m "owner-web: listings CRUD + bulk actions + photo uploader — Wave 03"
```

---

## Definition of Done

- [ ] `src/lib/api/listings.ts` exposes `list`, `get`, `create`, `patch`, `setStatus`, `archive`, `uploadMedia`, `deleteMedia`, `stats`, `duplicate`, `bulk`
- [ ] `ListingCard` displays status badge, resource type chip, primary photo (or icon placeholder), city, price (mono), view count
- [ ] `/listings` filters work for `status`, `resource_type`, `city`
- [ ] Multi-select with sticky bulk toolbar offers Activate / Pause / Archive; skipped listings render with reasons in an amber notice
- [ ] `/listings/new` creates a draft and redirects to its `/edit` page
- [ ] `/listings/{id}/edit` shows status, hero photo gallery, photo uploader, full form, and Activate / Pause / Archive actions
- [ ] Activate button is **disabled** unless the listing has a location AND ≥1 photo; an amber notice explains why
- [ ] `PhotoUploader` accepts drag-drop, queues files, uploads serially (one at a time, matching the backend), surfaces per-file state, and lets the user delete existing photos. Primary photo is marked with the 3px left Forge border
- [ ] `/listings/{id}` renders the read-only preview, pricing card, and the stats KPI grid from `GET /owner/listings/{id}/stats/`
- [ ] Duplicate creates a draft copy and routes to its editor
- [ ] All copy follows TDS voice; no emoji, no exclamations, sentence case for body, uppercase for caption/eyebrow
- [ ] `npm run typecheck` passes
- [ ] Git commit `owner-web: listings CRUD + bulk actions + photo uploader — Wave 03` is made
