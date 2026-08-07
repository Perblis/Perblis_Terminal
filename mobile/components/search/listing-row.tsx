import { Image, Pressable, View } from "react-native";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { resolveMediaUrl } from "../../lib/media";
import type { ListingTier, MapSoloListing } from "../../lib/types";
import { availabilityCaption } from "../map/pins";
import { BodyText, Money, MonoText } from "../ui/text";

/** Listing tier badge (basic renders nothing — trust is earned, not stamped). */
export function TierBadge({ tier }: { tier: ListingTier }) {
  if (tier === "basic") return null;
  return (
    <View
      className={`rounded-sm px-1.5 py-0.5 ${tier === "inspected" ? "bg-surface-inverse" : "bg-surface-sunken"}`}
    >
      <BodyText
        className={`text-caption ${tier === "inspected" ? "text-text-inverse" : "text-text-secondary"}`}
      >
        {tier === "inspected" ? "Inspected" : "Verified"}
      </BodyText>
    </View>
  );
}

/** S12 ListingCard row (asset grouping adds the +N-more-at-yard subline). */
export function ListingRow({
  listing,
  moreAtYard = 0,
  onPress,
}: {
  listing: MapSoloListing;
  moreAtYard?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row gap-3 border-b border-border bg-surface-card px-4 py-3 active:bg-surface-sunken"
    >
      {listing.photo ? (
        <Image source={{ uri: resolveMediaUrl(listing.photo) }} style={{ width: 88, height: 66, borderRadius: 6 }} />
      ) : (
        <View
          className="items-center justify-center rounded-md bg-surface-sunken"
          style={{ width: 88, height: 66 }}
        >
          <MonoText className="text-caption text-text-tertiary">—</MonoText>
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <BodyText className="flex-1 font-sans-medium" numberOfLines={1}>
            {listing.title}
          </BodyText>
          <TierBadge tier={listing.badge} />
        </View>
        <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
          {CLASS_BY_VALUE[listing.asset_class].label} · {listing.distance_km} km ·{" "}
          {availabilityCaption(listing)}
        </BodyText>
        <View className="mt-1 flex-row items-baseline gap-1">
          <Money display={listing.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
        </View>
        {moreAtYard > 0 ? (
          <BodyText className="mt-0.5 text-caption text-text-link">
            +{moreAtYard} more at this yard
          </BodyText>
        ) : null}
      </View>
    </Pressable>
  );
}
