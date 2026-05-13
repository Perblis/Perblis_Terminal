import Link from "next/link";

import type { Listing } from "@/lib/api/listings";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/format";

import { Badge } from "./Badge";
import { Card } from "./Card";
import { ResourceIcon } from "./ResourceIcon";
import { StatusDot } from "./StatusDot";

type Tone = "neutral" | "success" | "info" | "warn" | "danger" | "accent";

function statusTone(status: Listing["status"]): Tone {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warn";
    case "archived":
      return "neutral";
    case "draft":
    default:
      return "neutral";
  }
}

export function ListingCard({
  listing,
  selectable,
  selected,
  onSelect,
}: {
  listing: Listing;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, next: boolean) => void;
}) {
  return (
    <Card className={cn("overflow-hidden p-0", selected && "ring-forge ring-1")}>
      <div className="bg-surface-elevated relative h-[156px]">
        {listing.primary_photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.primary_photo_url}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ResourceIcon
              type={listing.resource_type}
              size={56}
              className="text-text-tertiary opacity-60"
            />
          </div>
        )}

        {selectable ? (
          <label className="bg-abyss/80 border-border absolute top-2 left-2 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border">
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelect?.(listing.id, e.target.checked)}
              className="border-text-secondary checked:bg-forge checked:border-forge h-3 w-3 appearance-none rounded-sm border"
              aria-label={`Select ${listing.title}`}
            />
          </label>
        ) : null}

        <span className="bg-abyss/85 border-border text-text-secondary rounded-pill absolute top-2 right-2 inline-flex h-5 items-center border px-2 text-[11px] tracking-[0.06em] uppercase">
          {listing.resource_type}
        </span>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/listings/${listing.id}`} className="block min-w-0 focus:outline-none">
            <div className="font-body truncate text-[14px] font-semibold">{listing.title}</div>
            <div className="font-body text-text-tertiary truncate text-[12px]">
              {listing.location_city ?? "No location"}
            </div>
          </Link>
          <Badge tone={statusTone(listing.status)}>
            <StatusDot status={listing.status} className="mr-1.5" />
            {listing.status}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-text-primary font-mono text-[15px]">
            {formatNaira(listing.price_daily)}
            <span className="text-text-tertiary text-[11px]"> /day</span>
          </span>
          <span className="text-text-tertiary font-mono text-[11px]">
            {listing.view_count} views
          </span>
        </div>
      </div>
    </Card>
  );
}
