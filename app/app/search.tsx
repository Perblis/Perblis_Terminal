import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingRow } from "../components/search/listing-row";
import { EmptyState } from "../components/ui/empty-state";
import { BodyText, DisplayText, Money, MonoText } from "../components/ui/text";
import { TextField } from "../components/ui/text-field";
import { ASSET_CLASSES } from "../lib/asset-classes";
import { parseNairaInput } from "../lib/naira";
import { useThemeTokens } from "../lib/theme";
import { resolveMediaUrl } from "../lib/media";
import { useListSearch, type ListRow } from "../lib/queries";
import type { SearchFilters } from "../lib/search-params";
import { useMapState } from "../stores/map-state";

const RADII = [5, 10, 25, 50, 100] as const;

/**
 * S12 Search & Results. Ordering is distance-only — the frozen /search/list
 * contract has no sort param (price sort is a recorded additive-backend ask).
 */
export default function Search() {
  const tk = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { region, classFilter, setClassFilter } = useMapState();

  const [q, setQ] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [specMin, setSpecMin] = useState("");
  const [specMax, setSpecMax] = useState("");
  const [groupBy, setGroupBy] = useState<"asset" | "location">("asset");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters: SearchFilters = useMemo(
    () => ({
      assetClass: classFilter,
      q,
      priceMinKobo: parseNairaInput(priceMin),
      priceMaxKobo: parseNairaInput(priceMax),
      specMin: specMin ? Number(specMin) : null,
      specMax: specMax ? Number(specMax) : null,
    }),
    [classFilter, q, priceMin, priceMax, specMin, specMax],
  );

  const search = useListSearch(
    { lat: region.centerLat, lng: region.centerLng, radiusKm },
    filters,
    groupBy,
  );

  const rows: ListRow[] = search.data?.pages.flatMap((p) => p.results) ?? [];

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (classFilter) {
    const meta = ASSET_CLASSES.find((c) => c.value === classFilter);
    activeChips.push({ key: "class", label: meta?.label ?? "", clear: () => setClassFilter(null) });
  }
  if (q) activeChips.push({ key: "q", label: `“${q}”`, clear: () => setQ("") });
  if (priceMin) activeChips.push({ key: "pmin", label: `≥ ₦${priceMin}`, clear: () => setPriceMin("") });
  if (priceMax) activeChips.push({ key: "pmax", label: `≤ ₦${priceMax}`, clear: () => setPriceMax("") });
  if (specMin || specMax) {
    activeChips.push({
      key: "spec",
      label: `★ ${specMin || "…"}–${specMax || "…"}`,
      clear: () => {
        setSpecMin("");
        setSpecMax("");
      },
    });
  }

  const renderRow = ({ item }: { item: ListRow }) => {
    if ("type" in item && item.type === "yard") {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/supplier/${item.supplier.id}` as never)}
          className="border-b border-border bg-surface-sunken px-4 py-3 active:opacity-90"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-surface-inverse">
              {item.supplier.logo ? (
                <Image source={{ uri: resolveMediaUrl(item.supplier.logo) }} style={{ width: 40, height: 40 }} />
              ) : (
                <MonoText className="text-text-brand-on-inverse">
                  {item.supplier.name.slice(0, 2).toUpperCase()}
                </MonoText>
              )}
            </View>
            <View className="flex-1">
              <BodyText className="font-sans-semibold" numberOfLines={1}>
                {item.name}
              </BodyText>
              <BodyText className="text-body-sm text-text-secondary">
                {item.listing_count} assets · {item.distance_km} km
              </BodyText>
            </View>
            <View className="items-end">
              <Money display={item.price_from_display} />
              <BodyText className="text-caption text-text-tertiary">/ day from</BodyText>
            </View>
          </View>
        </Pressable>
      );
    }
    const listing = item as Extract<ListRow, { id: string }>;
    return (
      <ListingRow
        listing={listing}
        moreAtYard={"more_at_yard" in listing ? listing.more_at_yard : 0}
        onPress={() => router.push(`/listing/${listing.id}` as never)}
      />
    );
  };

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      {/* Expanded pill: q + filter toggles */}
      <View className="gap-2 border-b border-border bg-surface-card px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={() => router.back()}>
            <DisplayText className="px-1 text-h3">←</DisplayText>
          </Pressable>
          <TextInput
            accessibilityLabel="Search assets"
            className="min-h-12 flex-1 rounded-full border border-border-strong bg-surface-page px-4 font-sans text-body text-text-primary"
            placeholder="Search assets, e.g. “30t excavator”"
            placeholderTextColor={tk["--text-tertiary"]}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            autoFocus
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setFiltersOpen((v) => !v)}
            className={`min-h-12 items-center justify-center rounded-full border px-3.5 ${filtersOpen ? "border-surface-inverse bg-surface-inverse" : "border-border-strong"}`}
          >
            <BodyText className={filtersOpen ? "text-text-inverse" : "text-text-primary"}>Filters</BodyText>
          </Pressable>
        </View>

        {filtersOpen ? (
          <View className="gap-3 pt-1">
            {/* Class chips */}
            <View className="flex-row flex-wrap gap-2">
              {ASSET_CLASSES.map((meta) => {
                const selected = classFilter === meta.value;
                return (
                  <Pressable
                    key={meta.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setClassFilter(selected ? null : meta.value)}
                    className={`rounded-full border px-3 py-1.5 ${selected ? "border-surface-inverse bg-surface-inverse" : "border-border-strong"}`}
                  >
                    <BodyText className={`text-body-sm ${selected ? "text-text-inverse" : "text-text-primary"}`}>
                      {meta.label}
                    </BodyText>
                  </Pressable>
                );
              })}
            </View>
            {/* Radius */}
            <View className="flex-row items-center gap-2">
              <BodyText className="text-body-sm text-text-secondary">Within</BodyText>
              {RADII.map((r) => (
                <Pressable
                  key={r}
                  accessibilityRole="button"
                  accessibilityState={{ selected: radiusKm === r }}
                  onPress={() => setRadiusKm(r)}
                  className={`rounded-full border px-3 py-1.5 ${radiusKm === r ? "border-surface-inverse bg-surface-inverse" : "border-border-strong"}`}
                >
                  <MonoText className={`text-body-sm ${radiusKm === r ? "text-text-inverse" : "text-text-primary"}`}>
                    {r}km
                  </MonoText>
                </Pressable>
              ))}
            </View>
            {/* Price */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label="Min ₦/day"
                  keyboardType="number-pad"
                  value={priceMin}
                  onChangeText={setPriceMin}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Max ₦/day"
                  keyboardType="number-pad"
                  value={priceMax}
                  onChangeText={setPriceMax}
                />
              </View>
            </View>
            {/* ★spec — class-dependent (server rejects without a class) */}
            {classFilter ? (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField
                    label="★ spec min"
                    keyboardType="numeric"
                    value={specMin}
                    onChangeText={setSpecMin}
                  />
                </View>
                <View className="flex-1">
                  <TextField
                    label="★ spec max"
                    keyboardType="numeric"
                    value={specMax}
                    onChangeText={setSpecMax}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Grouping + map toggle */}
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: groupBy === "asset" }}
            onPress={() => setGroupBy("asset")}
            className={`rounded-full border px-3 py-1.5 ${groupBy === "asset" ? "border-surface-inverse bg-surface-inverse" : "border-border-strong"}`}
          >
            <BodyText className={`text-body-sm ${groupBy === "asset" ? "text-text-inverse" : "text-text-primary"}`}>
              By asset
            </BodyText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: groupBy === "location" }}
            onPress={() => setGroupBy("location")}
            className={`rounded-full border px-3 py-1.5 ${groupBy === "location" ? "border-surface-inverse bg-surface-inverse" : "border-border-strong"}`}
          >
            <BodyText className={`text-body-sm ${groupBy === "location" ? "text-text-inverse" : "text-text-primary"}`}>
              By location
            </BodyText>
          </Pressable>
          <View className="flex-1" />
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <BodyText className="text-text-link">Map view →</BodyText>
          </Pressable>
        </View>

        {/* Clearable active-filter chips */}
        {activeChips.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {activeChips.map((chip) => (
              <Pressable
                key={chip.key}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${chip.label}`}
                onPress={chip.clear}
                className="flex-row items-center gap-1 rounded-full bg-surface-sunken px-3 py-1"
              >
                <BodyText className="text-body-sm text-text-secondary">{chip.label}</BodyText>
                <BodyText className="text-body-sm text-text-tertiary">✕</BodyText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Results */}
      {search.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            title={q ? `No matches for “${q}”` : "No matches"}
            body="Widen the radius or clear a filter."
          />
          {activeChips.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => activeChips.forEach((c) => c.clear())}
              className="pb-6"
            >
              <BodyText className="text-text-link">Clear all filters</BodyText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) =>
            "type" in item && item.type === "yard" ? `y-${item.yard_id}` : `l-${(item as { id: string }).id}-${i}`
          }
          renderItem={renderRow}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            search.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : <View className="h-8" />
          }
        />
      )}
    </View>
  );
}
