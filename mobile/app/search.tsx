import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RangeCalendar, type DateRange as CalendarRange } from "../components/hires/range-calendar";
import { FilterBar } from "../components/map/filter-bar";
import { FilterSheet } from "../components/search/filter-sheet";
import { ListingRow } from "../components/search/listing-row";
import { YardRow } from "../components/search/yard-row";
import { Chip } from "../components/ui/chip";
import { EmptyState } from "../components/ui/empty-state";
import { Segmented } from "../components/ui/segmented";
import { BodyText, DisplayText, MonoText } from "../components/ui/text";
import { ASSET_CLASSES } from "../lib/asset-classes";
import { assetNoun } from "../lib/asset-noun";
import { parseNairaInput } from "../lib/naira";
import { starFieldChipLabel } from "../lib/star-field";
import { useDebouncedCommit } from "../lib/use-debounced-commit";
import { useThemeTokens } from "../lib/theme";
import { useListSearch, type ListRow } from "../lib/queries";
import type { SearchFilters } from "../lib/search-params";
import type { AssetClass, ListLocationYard } from "../lib/types";
import { DEFAULT_RADIUS_KM, useMapState } from "../stores/map-state";

/**
 * S12 Search & Results.
 *
 * Ordering is distance-only — the frozen /search/list contract has no sort
 * param (price sort is a recorded additive-backend ask), so the summary line
 * says "nearest first" rather than pretending a sort control exists.
 *
 * 2026-08-09 hierarchy rework (founder): the header used to run ~150pt
 * collapsed and ~600pt expanded on a ~780pt viewport — with an autoFocus
 * keyboard on top, the assets were entirely below the fold. Advanced filters
 * moved into FilterSheet; the four loose grouping/view pills became two
 * Segmented controls; the class chips reuse the map's FilterBar so both
 * surfaces look like one product. Search → category → summary → assets.
 *
 * 2026-08-10 search/filter repair (founder: "something wrong with the search
 * and filter, more prevalent on the mobile apk"). Two structural faults:
 *
 * 1. Every keystroke wrote the shared store, so every keystroke was a request
 *    — and two, because expo-router keeps the map tab mounted behind this
 *    route. Typing "excavator" was 18 calls against a 60/min throttle, and the
 *    429 rendered as "Couldn't load results". Text inputs now hold a local
 *    draft and commit on a 300ms debounce (lib/use-debounced-commit.ts).
 * 2. radius/price/★ lived in `useState` here while class/q/dates lived in the
 *    store, so half the filter set silently reset on remount and the map could
 *    never be told about the other half. All of it now lives in map-state, so
 *    S4 and S12 filter one result set through one source of truth.
 */
export default function Search() {
  const tk = useThemeTokens();
  const insets = useSafeAreaInsets();
  // Every filter is shared with the S4 map (map-state store) so the two
  // surfaces can never disagree about what is being filtered.
  const {
    region,
    classFilter,
    dateRange,
    q,
    radiusKm,
    priceMin,
    priceMax,
    specMin,
    specMax,
    setClassFilter,
    setDateRange,
    setQ,
    setRadiusKm,
    setPriceMin,
    setPriceMax,
    setSpecMin,
    setSpecMax,
    clearFilters,
  } = useMapState();

  // Draft ↔ committed pairs: the draft is what the field shows (instant), the
  // committed value is what the query keys off (settled).
  const [qDraft, onQChange, resetQ] = useDebouncedCommit(q, setQ);
  const [priceMinDraft, onPriceMinChange, resetPriceMin] = useDebouncedCommit(priceMin, setPriceMin);
  const [priceMaxDraft, onPriceMaxChange, resetPriceMax] = useDebouncedCommit(priceMax, setPriceMax);
  const [specMinDraft, onSpecMinChange, resetSpecMin] = useDebouncedCommit(specMin, setSpecMin);
  const [specMaxDraft, onSpecMaxChange, resetSpecMax] = useDebouncedCommit(specMax, setSpecMax);

  const [groupBy, setGroupBy] = useState<"asset" | "location">("asset");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [pendingDates, setPendingDates] = useState<CalendarRange>({ start: null, end: null });

  // Changing the class invalidates the ★ bounds (the store clears them); cancel
  // any in-flight spec commit too, or a late timer would resurrect a bound that
  // belongs to the class the user just left.
  const changeClass = (next: typeof classFilter) => {
    setClassFilter(next);
    resetSpecMin("");
    resetSpecMax("");
  };

  const filters: SearchFilters = useMemo(
    () => ({
      assetClass: classFilter,
      q,
      priceMinKobo: parseNairaInput(priceMin),
      priceMaxKobo: parseNairaInput(priceMax),
      specMin: specMin ? Number(specMin) : null,
      specMax: specMax ? Number(specMax) : null,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
    }),
    [classFilter, q, priceMin, priceMax, specMin, specMax, dateRange],
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
    activeChips.push({ key: "class", label: meta?.label ?? "", clear: () => changeClass(null) });
  }
  if (q) activeChips.push({ key: "q", label: `“${q}”`, clear: () => resetQ("") });
  // Radius is the single biggest determinant of the result set and had no chip
  // at all — a 5km search looked identical to a 100km one. Shown once it
  // differs from the default so the default doesn't sit there as noise.
  if (radiusKm !== DEFAULT_RADIUS_KM) {
    activeChips.push({
      key: "radius",
      label: `Within ${radiusKm} km`,
      clear: () => setRadiusKm(DEFAULT_RADIUS_KM),
    });
  }
  if (priceMin) {
    activeChips.push({ key: "pmin", label: `≥ ₦${priceMin}`, clear: () => resetPriceMin("") });
  }
  if (priceMax) {
    activeChips.push({ key: "pmax", label: `≤ ₦${priceMax}`, clear: () => resetPriceMax("") });
  }
  // Guarded on classFilter to match what is actually sent: search-params drops
  // ★ bounds without a class (the server 400s them), so an unguarded chip
  // advertised a filter that wasn't being applied.
  if (classFilter && (specMin || specMax)) {
    activeChips.push({
      key: "spec",
      // Names the actual field ("Operating weight 10–30 tonnes") instead of "★".
      label: starFieldChipLabel(classFilter, specMin, specMax),
      clear: () => {
        resetSpecMin("");
        resetSpecMax("");
      },
    });
  }
  if (dateRange) {
    activeChips.push({
      key: "dates",
      label: `${dateRange.from} → ${dateRange.to}`,
      clear: () => setDateRange(null),
    });
  }

  const clearAll = () => {
    // Reset the drafts first (this also cancels their pending commits), then
    // clear the store — including class, dates and radius, which have no draft.
    resetQ("");
    resetPriceMin("");
    resetPriceMax("");
    resetSpecMin("");
    resetSpecMax("");
    clearFilters();
  };

  // A count, not a total: /search/list is keyset-paginated with no `count`
  // field, so "24+" is the honest form while another page exists. In location
  // grouping the rows are yard cards, so the noun follows the grouping rather
  // than calling every row an asset.
  // Yards are yards whatever they hold; assets take the class-aware noun
  // (D-029), derived from the rows actually on screen — a page mixing a cold
  // room and a tipper falls back to "listings".
  const noun =
    groupBy === "location"
      ? { one: "yard", many: "yards", kind: "listing" as const }
      : assetNoun(
          rows.flatMap((r) =>
            "asset_class" in r && r.asset_class ? [r.asset_class as AssetClass] : [],
          ),
        );
  const countLabel = `${rows.length}${search.hasNextPage ? "+" : ""} ${
    rows.length === 1 ? noun.one : noun.many
  }`;
  const summary = `${countLabel} · nearest first`;

  const backToMap = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as never);
  };

  const renderRow = ({ item }: { item: ListRow }) => {
    if ("type" in item && item.type === "yard") {
      const yard = item as ListLocationYard;
      return (
        <YardRow yard={yard} onPress={() => router.push(`/supplier/${yard.supplier.id}` as never)} />
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
      {/* Header: search → category → summary → assets. No border box — the
          results list's own hairlines separate it from the content. */}
      <View className="gap-2 bg-surface-page pb-2 pt-2">
        <View className="flex-row items-center gap-2 px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to map"
            hitSlop={12}
            onPress={backToMap}
          >
            <DisplayText className="pr-1 text-h3">←</DisplayText>
          </Pressable>
          <TextInput
            accessibilityLabel="Search assets"
            className="min-h-11 flex-1 rounded-full bg-surface-sunken px-4 font-sans text-body text-text-primary"
            // An example that actually returns results — "30t excavator"
            // matched nothing in the catalogue, so the first query a new hirer
            // tried came back empty and search looked broken on sight.
            placeholder="Search assets, e.g. “22t excavator”"
            placeholderTextColor={tk["--text-tertiary"]}
            value={qDraft}
            onChangeText={onQChange}
            returnKeyType="search"
            autoFocus
          />
          {/* The count badge is what lets the panel collapse without hiding
              state — the old "Filters" label gave no sign anything was on. */}
          <Pressable
            testID="open-filters"
            accessibilityRole="button"
            accessibilityLabel={
              activeChips.length > 0 ? `Filters, ${activeChips.length} active` : "Filters"
            }
            onPress={() => setFiltersOpen(true)}
            hitSlop={{ top: 8, bottom: 8 }}
            className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-surface-sunken px-3.5"
          >
            <BodyText className="text-body-sm text-text-primary">Filters</BodyText>
            {activeChips.length > 0 ? (
              <View className="h-5 min-w-5 items-center justify-center rounded-full bg-surface-brand px-1">
                <MonoText className="text-caption text-text-on-brand">
                  {activeChips.length}
                </MonoText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Category + the summary line, reusing the map's compact chip row. */}
        <FilterBar active={classFilter} onChange={changeClass} resultCount={null} countText={summary} />

        {/* Two controls, not four pills: what's grouped, and where it's shown. */}
        <View className="flex-row items-center justify-between px-4">
          <Segmented
            testID="group-by"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "asset", label: "Assets", a11yLabel: "Group by asset" },
              { value: "location", label: "Yards", a11yLabel: "Group by yard" },
            ]}
          />
          <Segmented
            testID="view-mode"
            value="list"
            onChange={(next) => {
              if (next === "map") backToMap();
            }}
            options={[
              { value: "list", label: "List", a11yLabel: "List view" },
              { value: "map", label: "Map", a11yLabel: "Map view" },
            ]}
          />
        </View>

        {/* Applied filters stay visible, countable and clearable (07 §8). */}
        {activeChips.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-2 px-4">
            {activeChips.map((chip) => (
              <Chip
                key={chip.key}
                testID={`chip-${chip.key}`}
                label={chip.label}
                dismissible
                a11yLabel={`Clear ${chip.label}`}
                onPress={chip.clear}
              />
            ))}
            {activeChips.length >= 2 ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearAll}
                hitSlop={{ top: 8, bottom: 8 }}
                className="h-8 justify-center px-1"
              >
                <BodyText className="text-body-sm text-text-link">Clear all</BodyText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Results */}
      {search.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : search.isError ? (
        /* This branch did not exist: a failed request fell through to the
           empty state and told the user their search was too narrow. */
        <View className="flex-1 items-center justify-center">
          <EmptyState
            title="Couldn’t load results"
            body="Check your connection and try again — your filters are still set."
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void search.refetch()}
            className="min-h-12 items-center justify-center rounded-md bg-surface-brand px-6 py-3"
          >
            <BodyText className="font-sans-semibold text-text-on-brand">Try again</BodyText>
          </Pressable>
          <View className="h-8" />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            title={q ? `No matches for “${q}”` : "No matches"}
            body="Widen the radius or clear a filter."
          />
          {activeChips.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={clearAll} className="pb-6">
              <BodyText className="text-text-link">Clear all filters</BodyText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        /* keepPreviousData means a filter change re-renders the OLD rows with
           isLoading false. Dimming them is the only signal the user gets that
           the list is about to change under them. */
        <View
          className="flex-1"
          style={{ opacity: search.isFetching && !search.isFetchingNextPage ? 0.55 : 1 }}
        >
          <FlatList
            data={rows}
            keyExtractor={(item, i) =>
              "type" in item && item.type === "yard" ? `y-${item.yard_id}` : `l-${(item as { id: string }).id}-${i}`
            }
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={() => {
              if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              search.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : <View className="h-8" />
            }
          />
        </View>
      )}

      {/* Advanced filters — a sheet, not a permanently expanded panel. */}
      {filtersOpen ? (
        <FilterSheet
          assetClass={classFilter}
          onAssetClass={changeClass}
          radiusKm={radiusKm}
          onRadiusKm={setRadiusKm}
          dateRange={dateRange}
          onOpenDates={() => {
            setPendingDates(
              dateRange ? { start: dateRange.from, end: dateRange.to } : { start: null, end: null },
            );
            setDatesOpen(true);
          }}
          onClearDates={() => setDateRange(null)}
          priceMin={priceMinDraft}
          priceMax={priceMaxDraft}
          onPriceMin={onPriceMinChange}
          onPriceMax={onPriceMaxChange}
          specMin={specMinDraft}
          specMax={specMaxDraft}
          onSpecMin={onSpecMinChange}
          onSpecMax={onSpecMaxChange}
          resultCount={rows.length}
          hasMore={search.hasNextPage ?? false}
          resultNoun={noun}
          activeCount={activeChips.length}
          onClearAll={clearAll}
          onDismiss={() => setFiltersOpen(false)}
        />
      ) : null}

      {/* Hire-dates picker (shared RangeCalendar) */}
      {datesOpen ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-4">
          <View className="w-full gap-3 rounded-lg bg-surface-card p-4">
            <DisplayText className="text-h3">When do you need it?</DisplayText>
            <RangeCalendar range={pendingDates} onChange={setPendingDates} />
            <BodyText className="text-caption text-text-tertiary">
              Results then show what’s free for those dates, not just today.
            </BodyText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (pendingDates.start && pendingDates.end) {
                  setDateRange({ from: pendingDates.start, to: pendingDates.end });
                }
                setDatesOpen(false);
              }}
              disabled={!pendingDates.start || !pendingDates.end}
              className={`min-h-12 items-center justify-center rounded-md py-3 ${pendingDates.start && pendingDates.end ? "bg-surface-brand" : "bg-surface-sunken"}`}
            >
              <BodyText className="font-sans-semibold text-text-on-brand">Apply dates</BodyText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDatesOpen(false)}
              className="min-h-12 items-center justify-center py-2"
            >
              <BodyText className="text-text-secondary">Cancel</BodyText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
