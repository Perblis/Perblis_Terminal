// S5 Yard Sheet: renders ENTIRELY from the /search/map yard payload —
// TSD §3.7 embeds the listing summaries for exactly this; zero extra
// round-trips (asserted by test).
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ASSET_CLASSES, CLASS_BY_VALUE } from "../../lib/asset-classes";
import type { AssetClass, MapYard, MapYardListing } from "../../lib/types";
import { availabilityCaption } from "./pins";
import { Sheet } from "../ui/sheet";
import { BodyText, DisplayText, Money, MonoText } from "../ui/text";

function VerifiedTick() {
  return (
    <View className="h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: "#1D4ED8" }}>
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d="M4 12l6 6 10-12" stroke="#FFFFFF" strokeWidth={3.5} fill="none" />
      </Svg>
    </View>
  );
}

export function YardSheet({ yard, onDismiss }: { yard: MapYard; onDismiss: () => void }) {
  const [classFilter, setClassFilter] = useState<AssetClass | null>(null);

  const grouped = useMemo(() => {
    const byClass = new Map<AssetClass, MapYardListing[]>();
    for (const listing of yard.listings) {
      if (classFilter && listing.asset_class !== classFilter) continue;
      const list = byClass.get(listing.asset_class) ?? [];
      list.push(listing);
      byClass.set(listing.asset_class, list);
    }
    return byClass;
  }, [yard.listings, classFilter]);

  const counts = useMemo(() => {
    const c = new Map<AssetClass, number>();
    for (const l of yard.listings) c.set(l.asset_class, (c.get(l.asset_class) ?? 0) + 1);
    return c;
  }, [yard.listings]);

  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Sheet onDismiss={onDismiss}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 pb-3">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-surface-inverse">
          {yard.supplier.logo ? (
            <Image source={{ uri: yard.supplier.logo }} style={{ width: 44, height: 44 }} />
          ) : (
            <MonoText className="text-body text-text-brand-on-inverse">{initials}</MonoText>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <DisplayText className="text-h3" numberOfLines={1}>
              {yard.name}
            </DisplayText>
            {yard.supplier.badge ? <VerifiedTick /> : null}
          </View>
          <BodyText className="text-body-sm text-text-secondary">
            {yard.supplier.name} · {yard.listing_count} assets
          </BodyText>
        </View>
      </View>

      {/* Class chips with counts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-14 border-b border-border">
        <View className="flex-row items-center gap-2 px-4 py-2.5">
          {ASSET_CLASSES.filter((m) => (counts.get(m.value) ?? 0) > 0).map((meta) => {
            const selected = classFilter === meta.value;
            return (
              <Pressable
                key={meta.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setClassFilter(selected ? null : meta.value)}
                className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
                  selected ? "border-surface-inverse bg-surface-inverse" : "border-border-strong bg-surface-card"
                }`}
              >
                <BodyText className={`text-body-sm ${selected ? "text-text-inverse" : "text-text-primary"}`}>
                  {meta.label}
                </BodyText>
                <MonoText className={`text-caption ${selected ? "text-text-inverse" : "text-text-tertiary"}`}>
                  {counts.get(meta.value)}
                </MonoText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Rows grouped by class */}
      <ScrollView className="flex-1">
        {[...grouped.entries()].map(([assetClass, listings]) => (
          <View key={assetClass}>
            <View className="bg-surface-sunken px-4 py-1.5">
              <BodyText className="text-overline text-text-tertiary">
                {CLASS_BY_VALUE[assetClass].label.toUpperCase()}
              </BodyText>
            </View>
            {listings.map((listing) => (
              <Pressable
                key={listing.id}
                accessibilityRole="button"
                onPress={() => {
                  onDismiss();
                  router.push(`/listing/${listing.id}` as never);
                }}
                className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-sunken"
              >
                {listing.photo ? (
                  <Image source={{ uri: listing.photo }} style={{ width: 64, height: 48, borderRadius: 6 }} />
                ) : (
                  <View
                    className="items-center justify-center rounded-md bg-surface-sunken"
                    style={{ width: 64, height: 48 }}
                  >
                    <MonoText className="text-caption text-text-tertiary">—</MonoText>
                  </View>
                )}
                <View className="flex-1">
                  <BodyText className="font-sans-medium" numberOfLines={1}>
                    {listing.title}
                  </BodyText>
                  <BodyText className="text-caption text-text-tertiary">
                    {availabilityCaption(listing)}
                  </BodyText>
                </View>
                <View className="items-end">
                  <Money display={listing.price_from_display} />
                  <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

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
    </Sheet>
  );
}
