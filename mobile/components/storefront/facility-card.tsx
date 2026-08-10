// S13 facility card — the storefront's product.
//
// Full-width and vertical (image → name → core spec → capabilities → price),
// because a hirer scanning a storefront is choosing BETWEEN things: the photo
// says it is real, the figures say whether it fits, the price says whether it
// is affordable. The image is deliberately 140dp rather than a 16:9 201dp
// showpiece — at 16:9 the card runs to ~311dp and exactly one facility fits a
// 390×844 screen, which turns a comparison into a feed.
//
// Purely presentational: it fetches nothing. The screen owns the reads and
// passes `spec` down once resolved, so this component can be tested without a
// QueryClient and a card whose specs never arrive still renders completely.
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { AssetNoun } from "../../lib/asset-noun";
import { capabilityLine, coreSpecLine } from "../../lib/capabilities";
import { resolveMediaUrl } from "../../lib/media";
import type { Listing, StorefrontListing } from "../../lib/types";
import { TierBadge } from "../search/listing-row";
import { RemoteImage } from "../ui/remote-image";
import { BodyText, Money, MonoText } from "../ui/text";

/** The capability row is the only variable-height content on the card, so its
 *  height is fixed: late-arriving specs swap text inside the box instead of
 *  reflowing the card under the reader's thumb. */
const CAPABILITY_ROW_HEIGHT = 18;

export function FacilityCard({
  listing,
  spec,
  noun,
}: {
  listing: StorefrontListing;
  /** The full listing once GET /listings/{id} resolves. Undefined before that,
   *  past the fetch cap, or when the read failed — all render identically. */
  spec?: Listing;
  noun: AssetNoun;
}) {
  const core = coreSpecLine(listing, spec);
  const capabilities = capabilityLine(listing, spec);

  return (
    <Pressable
      accessibilityRole="button"
      // Never built from `spec` — that payload carries address_text and point,
      // and this page's own copy says the exact address unlocks at Confirmed.
      accessibilityLabel={`${core.name}, ${core.spec}, ${listing.daily_price_display} a day`}
      onPress={() => router.push(`/listing/${listing.id}` as never)}
      className="mb-6 active:opacity-80"
    >
      <View className="overflow-hidden rounded-lg">
        {listing.cover_photo_url ? (
          <RemoteImage
            uri={resolveMediaUrl(listing.cover_photo_url)}
            style={{ width: "100%", height: 140 }}
            recyclingKey={listing.id}
          />
        ) : (
          <View className="h-[140px] items-center justify-center bg-surface-sunken">
            <MonoText className="text-caption text-text-tertiary">—</MonoText>
          </View>
        )}
      </View>

      <View className="gap-1 pt-2.5">
        <View className="flex-row items-start gap-2">
          <BodyText className="flex-1 text-body-lg font-sans-medium" numberOfLines={1}>
            {core.name}
          </BodyText>
          {/* Per-facility trust, not the company's. `basic` renders nothing. */}
          {spec ? <TierBadge tier={spec.tier} /> : null}
        </View>

        {/* Core specification — what it is and how big. Figures in mono. */}
        <View className="flex-row items-center gap-1.5">
          {core.figure ? (
            <MonoText className="text-mono text-text-secondary" numberOfLines={1}>
              {core.spec}
            </MonoText>
          ) : (
            <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
              {core.spec}
            </BodyText>
          )}
        </View>

        {/* Capabilities, or the honest fallback until (or unless) specs land. */}
        <View style={{ height: CAPABILITY_ROW_HEIGHT }} className="justify-center">
          <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
            {capabilities}
          </BodyText>
        </View>

        {/* Price is the anchor: the amount dominates, the period supports it. */}
        <View className="flex-row items-end justify-between pt-1">
          <View className="flex-row items-baseline gap-1">
            <Money display={listing.daily_price_display} className="text-money-md" />
            <BodyText className="text-body-sm text-text-tertiary">/ day</BodyText>
          </View>
          <BodyText className="text-body-sm text-text-link">View {noun.one} →</BodyText>
        </View>
      </View>
    </Pressable>
  );
}
