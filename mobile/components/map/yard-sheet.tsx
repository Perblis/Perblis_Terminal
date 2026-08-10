// S5 Yard Sheet: renders ENTIRELY from the /search/map yard payload —
// TSD §3.7 embeds the listing summaries for exactly this; zero extra
// round-trips (asserted by test).
//
// 3-stop revision (founder, 2026-08-08): this was an all-or-nothing overlay —
// either absent, or a half-height card that hid the map. It is now a genuinely
// collapsible sheet (peek 88pt · half 50% · full 92%, ch.04 §3) whose header
// IS the peek state. That header is also the single place a bay's identity is
// drawn: the map pin used to repeat the company, count and price, and no
// longer does. Rows lead with the asset name on its own line (splitListingTitle)
// so "Transit Concrete Mixer 8 m³ — ready-..." stops truncating mid-word.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "@terminal/tokens";

import { ASSET_CLASSES, CLASS_BY_VALUE } from "../../lib/asset-classes";
import { assetNoun, countNoun } from "../../lib/asset-noun";
import { splitListingTitle } from "../../lib/listing-title";
import { resolveMediaUrl } from "../../lib/media";
import type { AssetClass, MapYard } from "../../lib/types";
import { availabilityCaption } from "./pins";
import { MAP_SNAPS, Sheet, type SnapName } from "../ui/sheet";
import { BodyText, DisplayText, Money, MonoText } from "../ui/text";
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

/** Row thumbnail: sunken field behind the image so a slow/failed load never
 *  renders as a black hole; broken images fall back like S12's placeholder. */
function RowThumb({ photo, title }: { photo: string; title: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-md bg-surface-sunken"
      style={{ width: 72, height: 54 }}
    >
      {photo && !broken ? (
        <RemoteImage
          uri={resolveMediaUrl(photo)}
          style={{ width: 72, height: 54 }}
          accessibilityLabel={`Photo of ${title}`}
          onError={() => setBroken(true)}
        />
      ) : (
        <MonoText className="text-caption text-text-tertiary">—</MonoText>
      )}
    </View>
  );
}

/** Company identity block — the peek state, and the sheet header at every
 *  other stop. Answers: which bay, whose, how much is here, from what price. */
function YardIdentity({ yard, collapsed }: { yard: MapYard; collapsed: boolean }) {
  // A yard of cold rooms is a yard of facilities, not "assets" (D-029). The
  // payload already says which classes are in it.
  const noun = assetNoun(yard.class_mix);
  const availableCount = yard.listings.filter((l) => l.available).length;
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View className="flex-row items-center gap-3 px-4 pb-3">
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-surface-chrome">
        {yard.supplier.logo ? (
          <RemoteImage uri={resolveMediaUrl(yard.supplier.logo)} style={{ width: 48, height: 48 }} />
        ) : (
          <MonoText className="text-body text-text-brand-on-inverse">{initials}</MonoText>
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <DisplayText className="text-h2" numberOfLines={1}>
            {yard.name}
          </DisplayText>
          {yard.supplier.badge ? <VerifiedTick /> : null}
        </View>
        <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
          {yard.supplier.name}
        </BodyText>
        <View className="flex-row items-baseline gap-1">
          <BodyText className="text-caption text-text-tertiary">
            {countNoun(yard.listing_count, noun)} ·
          </BodyText>
          {/* green = availability (02 §3). A `text-status-*` class would slip
              past the text primitives' colour guard and lose to the default. */}
          <BodyText className="text-caption text-green-400">{availableCount} available</BodyText>
        </View>
        {yard.price_from > 0 ? (
          <View className="mt-0.5 flex-row items-baseline gap-1">
            <BodyText className="text-caption text-text-tertiary">From</BodyText>
            <Money display={yard.price_from_display} />
            <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
          </View>
        ) : null}
      </View>
      {/* The peek affordance: at 88pt this is the only thing telling the user
          there is more underneath. It disappears once the sheet is open. */}
      {collapsed ? (
        <BodyText className="text-body-sm text-text-link">{`View ${noun.many} ↑`}</BodyText>
      ) : null}
    </View>
  );
}

export function YardSheet({ yard, onDismiss }: { yard: MapYard; onDismiss: () => void }) {
  const [classFilter, setClassFilter] = useState<AssetClass | null>(null);
  const [snap, setSnap] = useState<SnapName>("half");

  // Flat rows, ordered by class (each row names its class in the caption —
  // one taxonomy layer; the chips already carry class + count, so the
  // ALL-CAPS section headers were saying everything twice).
  const rows = useMemo(() => {
    const order = new Map(ASSET_CLASSES.map((m, i) => [m.value, i]));
    return yard.listings
      .filter((l) => !classFilter || l.asset_class === classFilter)
      .slice()
      .sort(
        (a, b) => (order.get(a.asset_class) ?? 0) - (order.get(b.asset_class) ?? 0),
      );
  }, [yard.listings, classFilter]);

  const counts = useMemo(() => {
    const c = new Map<AssetClass, number>();
    for (const l of yard.listings) c.set(l.asset_class, (c.get(l.asset_class) ?? 0) + 1);
    return c;
  }, [yard.listings]);

  const collapsed = snap === "peek";

  return (
    <Sheet
      snapPoints={MAP_SNAPS}
      initialSnap="half"
      onSnapChange={setSnap}
      onDismiss={onDismiss}
      header={<YardIdentity yard={yard} collapsed={collapsed} />}
    >
      {/* Below the peek band. Hidden while collapsed so a half-clipped row
          never peeks out from under the identity block. */}
      {collapsed ? null : (
        <View className="flex-1 border-t border-border-default">
          {/* Class chips with counts — only when there's a mix to filter */}
          {counts.size > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="max-h-14 border-b border-border-default"
            >
              <View className="flex-row items-center gap-2 px-4 py-2.5">
                {ASSET_CLASSES.filter((m) => (counts.get(m.value) ?? 0) > 0).map((meta) => {
                  const selected = classFilter === meta.value;
                  return (
                    <Pressable
                      key={meta.value}
                      testID={`yard-class-chip-${meta.value}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setClassFilter(selected ? null : meta.value)}
                      hitSlop={{ top: 7, bottom: 7 }}
                      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                        selected ? "bg-ink-700" : "bg-surface-sunken"
                      }`}
                    >
                      <BodyText
                        className={`text-body-sm ${selected ? "text-text-primary" : "text-text-secondary"}`}
                      >
                        {meta.label}
                      </BodyText>
                      <MonoText
                        className={`text-caption ${selected ? "text-text-primary" : "text-text-tertiary"}`}
                      >
                        {counts.get(meta.value)}
                      </MonoText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}

          {/* Rows — asset name on its own line, then what it's for. A single
              right-aligned money column truncated titles mid-word, so price
              keeps its own line under the caption. */}
          <ScrollView className="flex-1">
            {rows.map((listing) => {
              const { name, qualifier } = splitListingTitle(listing.title);
              return (
                <Pressable
                  key={listing.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${listing.title}, ${listing.price_from_display} a day, ${availabilityCaption(listing)}`}
                  onPress={() => {
                    onDismiss();
                    router.push(`/listing/${listing.id}` as never);
                  }}
                  className="flex-row gap-3 border-b border-border-default px-4 py-3.5 active:bg-surface-sunken"
                >
                  <RowThumb photo={listing.photo} title={listing.title} />
                  <View className="flex-1 justify-center">
                    <BodyText className="font-sans-medium" numberOfLines={2}>
                      {name}
                    </BodyText>
                    <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
                      {qualifier ?? CLASS_BY_VALUE[listing.asset_class].label}
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
                  </View>
                </Pressable>
              );
            })}

            {/* Footer */}
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                onDismiss();
                router.push(`/supplier/${yard.supplier.id}` as never);
              }}
              className="items-center py-4"
            >
              <BodyText className="text-text-link">View company profile →</BodyText>
            </Pressable>
            <View className="h-16" />
          </ScrollView>
        </View>
      )}
    </Sheet>
  );
}
