"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { AssetForm } from "@/components/assets/asset-form";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { bff } from "@/lib/api";
import type { Listing } from "@/lib/types";

export default function EditAssetPage() {
  const { id } = useParams<{ id: string }>();
  const listing = useQuery({
    queryKey: ["listing", id],
    queryFn: () => bff<Listing>(`/listings/${id}`),
  });

  return (
    <>
      <PageHeader
        title={listing.data?.title ?? "Edit asset"}
        crumbs={[{ label: "Assets", href: "/assets" }, { label: "Edit" }]}
      />
      {listing.isPending ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-s4">
          <Skeleton className="h-s2 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : listing.isError ? (
        <Banner tone="danger">Couldn&apos;t load this listing. It may have been removed.</Banner>
      ) : (
        <AssetForm key={listing.data.id} initial={listing.data} />
      )}
    </>
  );
}
