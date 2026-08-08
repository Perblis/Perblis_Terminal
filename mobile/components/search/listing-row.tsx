import { Pressable, View } from "react-native";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { splitListingTitle } from "../../lib/listing-title";
import { resolveMediaUrl } from "../../lib/media";
import type { ListingTier, MapSoloListing } from "../../lib/types";
import { availabilityCaption } from "../map/pins";
import { BodyText, Money, MonoText } from "../ui/text";
import { RemoteImage } from "../ui/remote-image";

/** Listing tier badge (basic renders nothing — trust is earned, not stamped). */
export function TierBadge({ tier }: { tier: ListingTier }) {
  if (tier === "basic") return null;
  return (
    <View
      className={`rounded-sm px-1.5 py-0.5 ${tier === "inspected" ? "bg-ink-700" : "bg-surface-sunken"}`}
    >
      <BodyText
        className={`text-caption ${tier === "inspected" ? "text-text-primary" : "text-text-secondary"}`}
      >
        {tier === "inspected" ? "Inspected" : "Verified"}
      </BodyText>
    </View>
  );
}

/** S12 ListingCard row (asset grouping adds the +N-more-at-yard subline).
 *  Title splits onto two lines — asset, then what it's for — so the part a
 *  hirer scans for never shares a truncated line with prose. */
export function ListingRow({
  listing,
  moreAtYard = 0,
  onPress,
}: {
  listing: MapSoloListing;
  moreAtYard?: number;
  onPress: () => void;
}) {
  const { name, qualifier } = splitListingTitle(listing.title);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${listing.price_from_display} a day, ${availabilityCaption(listing)}`}
      onPress={onPress}
      className="flex-row gap-3 border-b border-border-default bg-surface-card px-4 py-3.5 active:bg-surface-sunken"
    >
      {listing.photo ? (
        <RemoteImage
          uri={resolveMediaUrl(listing.photo)}
          style={{ width: 88, height: 66, borderRadius: 6 }}
          recyclingKey={listing.id}
        />
      ) : (
        <View
          className="items-center justify-center rounded-md bg-surface-sunken"
          style={{ width: 88, height: 66 }}
        >
          <MonoText className="text-caption text-text-tertiary">—</MonoText>
        </View>
      )}
      <View className="flex-1 justify-center">
        <View className="flex-row items-start gap-1.5">
          <BodyText className="flex-1 font-sans-medium" numberOfLines={2}>
            {name}
          </BodyText>
          <TierBadge tier={listing.badge} />
        </View>
        <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
          {qualifier ?? CLASS_BY_VALUE[listing.asset_class].label} · {listing.distance_km} km
        </BodyText>
        <View className="mt-1 flex-row items-baseline gap-1.5">
          <Money display={listing.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
          <BodyText
            className={`text-caption ${listing.available ? "text-green-400" : "text-text-tertiary"}`}
          >
            · {availabilityCaption(listing)}
          </BodyText>
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
