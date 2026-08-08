// S12 yard row (`group_by=location`). Extracted from an inline block in
// app/search.tsx on 2026-08-09 and given the SAME identity anatomy the map's
// yard sheet peek and rail card now share — bay → company → counts → from-price
// — so a yard reads as the same object wherever the hirer meets it.
//
// Renders entirely from the list payload: ListLocationYard carries `name`,
// `supplier` and the embedded `listings[]`, so the available count needs no
// extra fetch.
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "@terminal/tokens";

import { resolveMediaUrl } from "../../lib/media";
import type { ListLocationYard } from "../../lib/types";
import { BodyText, Money, MonoText } from "../ui/text";
import { RemoteImage } from "../ui/remote-image";

/** Blue = trust/navigation (02 §3 colour semantics). */
function VerifiedTick() {
  return (
    <View
      className="h-4 w-4 items-center justify-center rounded-full"
      style={{ backgroundColor: tokens.color.colorBlue400 }}
    >
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d="M4 12l6 6 10-12" stroke={tokens.color.colorPaper0} strokeWidth={3.5} fill="none" />
      </Svg>
    </View>
  );
}

export function YardRow({ yard, onPress }: { yard: ListLocationYard; onPress: () => void }) {
  const availableCount = yard.listings.filter((l) => l.available).length;
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Yard: ${yard.name}, ${yard.supplier.name}, ${yard.listing_count} assets, ${yard.distance_km} km away`}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border-default px-4 py-4 active:bg-surface-sunken"
    >
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-surface-chrome">
        {yard.supplier.logo ? (
          <RemoteImage
            uri={resolveMediaUrl(yard.supplier.logo)}
            style={{ width: 48, height: 48 }}
            recyclingKey={yard.yard_id}
          />
        ) : (
          <MonoText className="text-text-brand-on-inverse">{initials}</MonoText>
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <BodyText className="font-sans-medium" numberOfLines={1}>
            {yard.name}
          </BodyText>
          {yard.supplier.badge ? <VerifiedTick /> : null}
        </View>
        <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
          {yard.supplier.name}
        </BodyText>
        <BodyText className="text-caption" numberOfLines={1}>
          <BodyText className="text-caption text-green-400">{availableCount} available</BodyText>
          <BodyText className="text-caption text-text-tertiary">
            {" of "}
            {yard.listing_count} · {yard.distance_km} km
          </BodyText>
        </BodyText>
        <View className="flex-row items-baseline gap-1">
          <BodyText className="text-caption text-text-tertiary">From</BodyText>
          <Money display={yard.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
        </View>
      </View>
      <BodyText className="text-body-sm text-text-link">View →</BodyText>
    </Pressable>
  );
}
