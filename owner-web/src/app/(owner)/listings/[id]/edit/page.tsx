"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ListingForm, type ListingFormValues } from "@/components/listings/ListingForm";
import { PhotoUploader } from "@/components/listings/PhotoUploader";
import { pickSpecsForApi, specsDefaultsForForm, specsFormBaseDefaults } from "@/components/listings/listingSpecConfig";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { listingsApi, type ListingCreatePayload } from "@/lib/api/listings";
import { type ListingStatus, QUERY_KEYS } from "@/lib/constants";

function valuesToPatchPayload(v: ListingFormValues): Partial<ListingCreatePayload> {
  return {
    resource_type: v.resource_type,
    title: v.title,
    description: v.description,
    category: v.category ?? "",
    price_daily: v.price_daily,
    price_weekly: v.price_weekly,
    price_monthly: v.price_monthly,
    specs: pickSpecsForApi(v.resource_type, v.specs),
    latitude: v.latitude,
    longitude: v.longitude,
    location_address: v.location_address ?? "",
    location_city: v.location_city ?? "",
    operator_available: v.operator_available ?? false,
    delivery_available: v.delivery_available ?? false,
  };
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.listing(id),
    queryFn: () => listingsApi.get(id),
  });

  const patch = useMutation({
    mutationFn: (v: ListingFormValues) => listingsApi.patch(id, valuesToPatchPayload(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) }),
  });

  const setStatus = useMutation({
    mutationFn: (status: ListingStatus) => listingsApi.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <p className="text-alert-soft text-[13px]">Could not load the listing.</p>;
  }

  const l = q.data;
  const hasLocation = l.latitude !== null && l.longitude !== null;
  const hasPhoto = (l.media?.length ?? 0) > 0;
  const canActivate = hasLocation && hasPhoto;
  const statusError = (() => {
    if (!setStatus.error) return null;
    if (setStatus.error instanceof ApiError) {
      const body = setStatus.error.body as
        | { errors?: Record<string, string[] | string> }
        | undefined;
      if (body?.errors && typeof body.errors === "object") {
        const first = Object.values(body.errors)[0];
        if (Array.isArray(first) && first[0]) return first[0];
        if (typeof first === "string") return first;
      }
    }
    return (setStatus.error as Error).message;
  })();

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
              <Button
                variant="secondary"
                onClick={() => setStatus.mutate("paused")}
                disabled={setStatus.isPending}
              >
                Pause
              </Button>
            ) : null}
            {l.status !== "archived" ? (
              <Button
                variant="danger"
                onClick={() => setStatus.mutate("archived")}
                disabled={setStatus.isPending}
              >
                Archive
              </Button>
            ) : null}
          </>
        }
      />

      {!canActivate && l.status !== "active" ? (
        <div className="rounded-card border-amber-dim bg-amber-dim/40 text-amber border p-4 text-[13px]">
          {hasLocation
            ? "Add at least one photo before activating."
            : hasPhoto
              ? "Add a location before activating."
              : "Add a location and at least one photo before activating."}
        </div>
      ) : null}

      {statusError ? (
        <div className="rounded-card border-alert-dim bg-alert-dim/40 text-alert-soft border p-4 text-[13px]">
          {statusError}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Photos</h2>
        <PhotoUploader
          listingId={id}
          media={l.media ?? []}
          onChange={() => qc.invalidateQueries({ queryKey: QUERY_KEYS.listing(id) })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Details</h2>
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
            specs: {
              ...specsFormBaseDefaults(l.resource_type),
              ...specsDefaultsForForm(l.resource_type, l.specs),
            },
          }}
          submitting={patch.isPending}
          submitLabel="Save"
          onSubmit={(v) => patch.mutate(v)}
        />
        {patch.isSuccess ? <p className="text-clear-soft text-[12px]">Saved.</p> : null}
      </section>
    </div>
  );
}
