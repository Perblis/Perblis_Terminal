import { Image, Pressable, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { resolveMediaUrl } from "../../lib/media";
import type { MapSelection } from "./terminal-map";
import { availabilityCaption } from "./pins";
import { BodyText, DisplayText, Money, MonoText } from "../ui/text";

/**
 * S4 bottom peek card: listing summary (→ S6) or yard summary (→ S5).
 * Momentum/slide feel per V5; content is entirely from the map payload.
 */
export function PeekCard({
  selection,
  onOpen,
  bottomInset,
}: {
  selection: NonNullable<MapSelection>;
  onOpen: () => void;
  bottomInset: number;
}) {
  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={SlideOutDown}
      className="absolute inset-x-3 rounded-lg border border-border bg-surface-card p-3 shadow-lg"
      style={{ bottom: bottomInset + 12 }}
    >
      <Pressable accessibilityRole="button" onPress={onOpen} className="flex-row items-center gap-3">
        {selection.kind === "listing" ? (
          <>
            {selection.listing.photo ? (
              <Image
                source={{ uri: resolveMediaUrl(selection.listing.photo) }}
                style={{ width: 72, height: 54, borderRadius: 6 }}
              />
            ) : (
              <View className="h-14 w-18 items-center justify-center rounded-md bg-surface-sunken" style={{ width: 72, height: 54 }}>
                <MonoText className="text-caption text-text-tertiary">No photo</MonoText>
              </View>
            )}
            <View className="flex-1">
              <DisplayText className="text-h3" numberOfLines={1}>
                {selection.listing.title}
              </DisplayText>
              <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
                {CLASS_BY_VALUE[selection.listing.asset_class].label} ·{" "}
                {selection.listing.distance_km} km · {availabilityCaption(selection.listing)}
              </BodyText>
              <View className="mt-0.5 flex-row items-baseline gap-1">
                <Money display={selection.listing.price_from_display} />
                <BodyText className="text-caption text-text-tertiary">/ day from</BodyText>
              </View>
            </View>
          </>
        ) : (
          <>
            {selection.yard.supplier.logo ? (
              <Image
                source={{ uri: resolveMediaUrl(selection.yard.supplier.logo) }}
                style={{ width: 54, height: 54, borderRadius: 6 }}
              />
            ) : (
              <View className="items-center justify-center rounded-md bg-surface-inverse" style={{ width: 54, height: 54 }}>
                <MonoText className="text-body text-text-brand-on-inverse">
                  {selection.yard.supplier.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("")}
                </MonoText>
              </View>
            )}
            <View className="flex-1">
              <DisplayText className="text-h3" numberOfLines={1}>
                {selection.yard.name}
              </DisplayText>
              <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
                {selection.yard.supplier.name} · {selection.yard.listing_count} assets ·{" "}
                {selection.yard.listings.filter((l) => l.available).length} available
              </BodyText>
              <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
                {selection.yard.class_mix.map((c) => CLASS_BY_VALUE[c].label).join(" · ")}
              </BodyText>
              <View className="mt-0.5 flex-row items-baseline gap-1">
                <Money display={selection.yard.price_from_display} />
                <BodyText className="text-caption text-text-tertiary">/ day from</BodyText>
              </View>
            </View>
          </>
        )}
        <BodyText className="text-text-link">Open →</BodyText>
      </Pressable>
    </Animated.View>
  );
}
