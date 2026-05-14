"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { ListingForm, type ListingFormValues } from "@/components/listings/ListingForm";
import { ApiError } from "@/lib/api/client";
import { listingsApi, type ListingCreatePayload } from "@/lib/api/listings";

function valuesToPayload(v: ListingFormValues): ListingCreatePayload {
  return {
    resource_type: v.resource_type,
    title: v.title,
    description: v.description,
    category: v.category || undefined,
    price_daily: v.price_daily,
    price_weekly: v.price_weekly,
    price_monthly: v.price_monthly,
    latitude: v.latitude,
    longitude: v.longitude,
    location_address: v.location_address || undefined,
    location_city: v.location_city || undefined,
    operator_available: v.operator_available ?? false,
    delivery_available: v.delivery_available ?? false,
  };
}

export default function NewListingPage() {
  const router = useRouter();
  const create = useMutation({
    mutationFn: (v: ListingFormValues) => listingsApi.create(valuesToPayload(v)),
    onSuccess: (listing) => router.replace(`/listings/${listing.id}/edit`),
  });

  const errorMessage = (() => {
    if (!create.error) return null;
    if (create.error instanceof ApiError) {
      const body = create.error.body as { errors?: Record<string, string[] | string> } | undefined;
      if (body?.errors && typeof body.errors === "object") {
        const first = Object.values(body.errors)[0];
        if (Array.isArray(first) && first[0]) return first[0];
        if (typeof first === "string") return first;
      }
      return create.error.message || "Could not create the listing.";
    }
    return (create.error as Error).message;
  })();

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
        onSubmit={(v) => create.mutate(v)}
      />
      {errorMessage ? <p className="text-alert-soft text-[13px]">{errorMessage}</p> : null}
    </div>
  );
}
