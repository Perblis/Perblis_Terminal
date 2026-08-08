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

/**
 * S12 result row. 2026-08-09 (founder: "separate asset type, availability,
 * distance and pricing instead of cramming all metadata into one line" /
 * "make price and availability stronger visual anchors").
 *
 * One metadata line became three, so each answers its own question:
 *
 *   [96×72]  Transit Concrete Mixer 8 m³        [Verified]
 *            Ready-mix delivery                  ← what kind
 *            Available now · 4.2 km              ← can I have it, how far
 *            ₦165,000 / day                      ← what it costs (the anchor)
 *            +3 more at this yard
 *
 * The secondary line is the title's own qualifier (splitListingTitle) because
 * /search/list carries no `asset_type` — verified against
 * ListAssetItemSerializer, which adds only `yard_id` and `more_at_yard` to the
 * solo-listing shape. It falls back to the class label when a supplier wrote a
 * title with no qualifier.
 */
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
      accessibilityLabel={`${listing.title}, ${listing.price_from_display} a day, ${availabilityCaption(listing)}, ${listing.distance_km} km away`}
      onPress={onPress}
      className="flex-row gap-3 border-b border-border-default px-4 py-4 active:bg-surface-sunken"
    >
      {listing.photo ? (
        <RemoteImage
          uri={resolveMediaUrl(listing.photo)}
          style={{ width: 96, height: 72, borderRadius: 6 }}
          recyclingKey={listing.id}
        />
      ) : (
        <View
          className="items-center justify-center rounded-md bg-surface-sunken"
          style={{ width: 96, height: 72 }}
        >
          <MonoText className="text-caption text-text-tertiary">—</MonoText>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-start gap-1.5">
          <BodyText className="flex-1 font-sans-medium" numberOfLines={2}>
            {name}
          </BodyText>
          <TierBadge tier={listing.badge} />
        </View>

        <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
          {qualifier ?? CLASS_BY_VALUE[listing.asset_class].label}
        </BodyText>

        {/* Availability leads its own line and carries the green — colour PLUS
            label, never colour alone (02 §3). */}
        <BodyText className="text-caption" numberOfLines={1}>
          <BodyText
            className={`text-caption ${listing.available ? "text-green-400" : "text-text-tertiary"}`}
          >
            {availabilityCaption(listing)}
          </BodyText>
          <BodyText className="text-caption text-text-tertiary">
            {" · "}
            {listing.distance_km} km
          </BodyText>
        </BodyText>

        <View className="flex-row items-baseline gap-1">
          <Money display={listing.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
        </View>

        {moreAtYard > 0 ? (
          <BodyText className="text-caption text-text-link">
            +{moreAtYard} more at this yard
          </BodyText>
        ) : null}
      </View>
    </Pressable>
  );
}
