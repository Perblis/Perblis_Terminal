import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterBar } from "../../components/map/filter-bar";
import {
  PinCarousel,
  carouselItems,
  type CarouselItem,
} from "../../components/map/pin-carousel";
import {
  TerminalMap,
  type MapSelection,
  type TerminalMapHandle,
} from "../../components/map/terminal-map";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText } from "../../components/ui/text";
import { useMapSearch } from "../../lib/queries";
import { useThemeTokens } from "../../lib/theme";
import type { Bbox } from "../../lib/search-params";
import { YardSheet } from "../../components/map/yard-sheet";
import { useMapState } from "../../stores/map-state";

/** S4 Map (Home) — the front door. Terminal Chart + pins per 06 §3. */
export default function MapTab() {
  const insets = useSafeAreaInsets();
  const tk = useThemeTokens();
  const mapRef = useRef<TerminalMapHandle>(null);
  const { region, classFilter, dateRange, setRegion, setClassFilter, pendingFocus, clearFocus } =
    useMapState();

  // One-shot focus handed over from another screen (S13 yard card).
  useEffect(() => {
    if (!pendingFocus) return;
    mapRef.current?.flyTo(pendingFocus.centerLng, pendingFocus.centerLat, pendingFocus.zoom);
    clearFocus();
  }, [pendingFocus, clearFocus]);

  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [selection, setSelection] = useState<MapSelection>(null);
  const [yardSheet, setYardSheet] = useState<import("../../lib/types").MapYard | null>(null);
  const [locateAsk, setLocateAsk] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => setOffline(s.isConnected === false));
    return () => sub();
  }, []);

  // The parent owns the 400ms fetch debounce (S4 spec).
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegionChanged = useCallback(
    (nextBbox: Bbox, zoom: number, center: [number, number]) => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        setBbox(nextBbox);
        setRegion({ centerLng: center[0], centerLat: center[1], zoom });
      }, 400);
    },
    [setRegion],
  );

  const search = useMapSearch(
    bbox ?? { minLng: Number.NaN, minLat: Number.NaN, maxLng: Number.NaN, maxLat: Number.NaN },
    { assetClass: classFilter, dateFrom: dateRange?.from, dateTo: dateRange?.to },
  );

  const yards = search.data?.yards ?? [];
  const solos = search.data?.listings ?? [];
  const items = carouselItems(yards, solos);
  const total = search.data ? yards.reduce((n, y) => n + y.matching_count, 0) + solos.length : null;
  const overCap = yards.length + solos.length > 200;
  const emptyViewport = search.data && yards.length === 0 && solos.length === 0;

  const locate = async () => {
    setLocateAsk(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationDenied(true);
      return;
    }
    setLocationDenied(false);
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);
    if (pos) mapRef.current?.flyTo(pos.coords.longitude, pos.coords.latitude, 13);
  };

  const openItem = (item: CarouselItem) => {
    if (item.kind === "listing") {
      router.push(`/listing/${item.listing.id}` as never);
    } else {
      // S5 opens in-screen from the map payload — drag-dismiss preserves
      // the map position (zero navigation, zero fetches).
      setYardSheet(item.yard);
    }
  };

  // Swiping the carousel selects the card's pin and pans to it (zoom kept).
  const onCarouselActive = (item: CarouselItem) => {
    const next =
      item.kind === "yard"
        ? ({ kind: "yard", yard: item.yard } as const)
        : ({ kind: "listing", listing: item.listing } as const);
    setSelection(next);
    const point = item.kind === "yard" ? item.yard.point : item.listing.point;
    mapRef.current?.flyTo(point.coordinates[0], point.coordinates[1]);
  };

  return (
    <View className="flex-1 bg-surface-page">
      <TerminalMap
        ref={mapRef}
        initialCenter={[region.centerLng, region.centerLat]}
        initialZoom={region.zoom}
        yards={yards}
        solos={solos}
        filtered={classFilter !== null}
        selection={selection}
        onSelect={setSelection}
        onRegionChanged={onRegionChanged}
        onMapError={() => setTilesFailed(true)}
      />

      {/* Floating search pill + filter bar */}
      <View className="absolute inset-x-0" style={{ top: insets.top + 8 }}>
        <Pressable
          accessibilityRole="search"
          onPress={() => router.push("/search" as never)}
          className="mx-4 min-h-12 flex-row items-center gap-2 rounded-full border border-border bg-surface-card px-4 py-3 shadow-md"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Circle cx={10.5} cy={10.5} r={7} stroke={tk["--text-secondary"]} strokeWidth={2} fill="none" />
            <Path d="M16 16l5.5 5.5" stroke={tk["--text-secondary"]} strokeWidth={2} />
          </Svg>
          <BodyText className="text-text-tertiary">Search assets, e.g. “30t excavator”</BodyText>
        </Pressable>
        <View className="mt-2">
          <FilterBar active={classFilter} onChange={setClassFilter} resultCount={total} />
        </View>
        {overCap ? (
          <View className="mt-2 items-center">
            <View className="rounded-full bg-surface-inverse px-4 py-1.5">
              <BodyText className="text-body-sm text-text-inverse">Zoom in to see all</BodyText>
            </View>
          </View>
        ) : null}
      </View>

      {/* Banners (07 §3 postures) */}
      {offline ? (
        <Banner text="You’re offline — showing the last results." top={insets.top + 116} />
      ) : null}
      {tilesFailed ? (
        <Banner
          text="Map tiles aren’t loading. Use the list instead →"
          top={insets.top + 116}
          onPress={() => router.push("/search" as never)}
        />
      ) : null}
      {locationDenied ? (
        <Banner
          text="Location is off — showing Lagos. Tap to enable in Settings."
          top={insets.top + 156}
          onPress={() => void Linking.openSettings()}
        />
      ) : null}

      {/* Locate-me */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centre the map on my location"
        onPress={() => setLocateAsk(true)}
        className="absolute right-4 h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-card shadow-md"
        style={{ bottom: insets.bottom + (items.length > 0 ? 116 : 24) }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={6.5} stroke={tk["--text-primary"]} strokeWidth={2} fill="none" />
          <Circle cx={12} cy={12} r={2} fill={tk["--surface-brand"]} />
          <Path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke={tk["--text-primary"]} strokeWidth={2} />
        </Svg>
      </Pressable>

      {/* Contextual pre-prompt BEFORE the OS dialog (J2) */}
      {locateAsk ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-6">
          <View className="w-full gap-3 rounded-lg bg-surface-card p-5">
            <BodyText className="font-sans-semibold text-body-lg">
              Show assets near your site?
            </BodyText>
            <BodyText className="text-text-secondary">
              Terminal uses your location once to centre the map — it isn’t stored or shared with
              suppliers.
            </BodyText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void locate()}
              className="min-h-12 items-center justify-center rounded-md bg-surface-brand py-3"
            >
              <BodyText className="font-sans-semibold text-text-on-brand">Use my location</BodyText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLocateAsk(false)}
              className="min-h-12 items-center justify-center py-2"
            >
              <BodyText className="text-text-secondary">Not now</BodyText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Empty viewport */}
      {emptyViewport ? (
        <View className="absolute inset-x-8 top-1/3 rounded-lg border border-border bg-surface-card">
          <EmptyState
            title="Nothing here yet"
            body="Widen the search or move the map — new yards come online every week."
            compact
          />
        </View>
      ) : null}

      {/* Snap-to-pin carousel — the browsing surface (replaces the peek card).
          Swipe ↔ pin selection stay in sync; tap a card to open it. */}
      {items.length > 0 && !yardSheet ? (
        <PinCarousel
          items={items}
          selection={selection}
          onActive={onCarouselActive}
          onOpen={openItem}
          bottomInset={insets.bottom}
        />
      ) : null}

      {/* S5 Yard Sheet */}
      {yardSheet ? <YardSheet yard={yardSheet} onDismiss={() => setYardSheet(null)} /> : null}
    </View>
  );
}

function Banner({ text, top, onPress }: { text: string; top: number; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      onPress={onPress}
      className="absolute inset-x-4 rounded-md bg-surface-inverse px-4 py-2.5"
      style={{ top }}
    >
      <BodyText className="text-body-sm text-text-inverse">{text}</BodyText>
    </Pressable>
  );
}
