// S4 snap-to-pin carousel (founder direction, 2026-07-12): the bottom card
// slider IS the browsing surface — swiping cards pans the map and highlights
// the matching pin; tapping a pin snaps the carousel to its card. Pins stay
// minimal (compact plates); the card carries photo/price/availability. A yard
// item shows the yard summary and opens the S5 YardSheet on tap. Plain
// FlatList (FlashList is not a dependency); a syncSource ref breaks the
// swipe→select→scrollToIndex feedback loop.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, FlatList, Image, Pressable, View, type ViewToken } from "react-native";

import { tokens } from "@terminal/tokens";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { resolveMediaUrl } from "../../lib/media";
import type { MapSoloListing, MapYard } from "../../lib/types";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import { BodyText, DisplayText, Money, MonoText } from "../ui/text";
import { availabilityCaption } from "./pins";
import type { MapSelection } from "./terminal-map";

export type CarouselItem =
  | { kind: "yard"; yard: MapYard }
  | { kind: "listing"; listing: MapSoloListing };

const GAP = 8;
const H_PADDING = 16;

export function carouselItems(yards: MapYard[], solos: MapSoloListing[]): CarouselItem[] {
  return [
    ...yards.map((yard) => ({ kind: "yard" as const, yard })),
    ...solos.map((listing) => ({ kind: "listing" as const, listing })),
  ];
}

function itemKey(item: CarouselItem): string {
  return item.kind === "yard" ? `y-${item.yard.yard_id}` : `l-${item.listing.id}`;
}

function selectionKey(selection: MapSelection): string | null {
  if (!selection) return null;
  return selection.kind === "yard" ? `y-${selection.yard.yard_id}` : `l-${selection.listing.id}`;
}

/** Guards shared between the viewability handler and the snap effect. */
export type SyncGuards = {
  /** A programmatic scroll is in flight — its viewability echo must not re-select. */
  snapInFlight: { current: boolean };
  /** The currently selected card's key (mirror of the `selection` prop). */
  activeKey: { current: string | null };
  /** One-shot token: the key this carousel just reported via onActive (swipe
   *  origin), so the snap effect knows the selection change is its own echo. */
  lastReportedKey: { current: string | null };
};

/** The swipe→select half of the sync, factored pure for tests: activates the
 *  focused card unless it is already selected or a programmatic snap's echo. */
export function makeViewabilityHandler(
  guards: SyncGuards,
  onActive: { current: (item: CarouselItem) => void },
) {
  return ({ viewableItems }: { viewableItems: ViewToken<CarouselItem>[] }) => {
    if (guards.snapInFlight.current) return;
    const focused = viewableItems.find((v) => v.isViewable);
    if (!focused?.item) return;
    const key = itemKey(focused.item);
    if (key === guards.activeKey.current) return;
    guards.lastReportedKey.current = key;
    onActive.current(focused.item);
  };
}

/** The selection→carousel half, factored pure for tests. Decides, per
 *  selection change, whether to snap (animated — a pin tap or external
 *  selection), realign (instant — the data reordered under the same
 *  selection, e.g. a distance re-sort after a user pan), or hold still (the
 *  change is the echo of this carousel's own swipe, or the item vanished). */
export function makeSnapPlanner(guards: Pick<SyncGuards, "lastReportedKey">) {
  let prevKey: string | null = null;
  let prevIndex = -1;
  return (activeKey: string | null, activeIndex: number): "snap" | "realign" | "hold" => {
    const keyChanged = activeKey !== prevKey;
    const lastIndex = prevIndex;
    prevKey = activeKey;
    prevIndex = activeIndex;
    if (!activeKey || activeIndex < 0) return "hold";
    if (keyChanged) {
      const fromOwnSwipe = activeKey === guards.lastReportedKey.current;
      guards.lastReportedKey.current = null; // one-shot, consumed either way
      return fromOwnSwipe ? "hold" : "snap";
    }
    return activeIndex !== lastIndex ? "realign" : "hold";
  };
}

export function PinCarousel({
  items,
  selection,
  onActive,
  onOpen,
  bottomInset,
}: {
  items: CarouselItem[];
  selection: MapSelection;
  /** A card became active by swiping — select its pin + pan the map. */
  onActive: (item: CarouselItem) => void;
  /** The active card was tapped — open S6 (listing) / S5 (yard sheet). */
  onOpen: (item: CarouselItem) => void;
  bottomInset: number;
}) {
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const cardWidth = Dimensions.get("window").width - H_PADDING * 2 - 24;
  const interval = cardWidth + GAP;

  const activeKey = selectionKey(selection);
  const activeIndex = useMemo(
    () => (activeKey ? items.findIndex((it) => itemKey(it) === activeKey) : -1),
    [items, activeKey],
  );

  // Sync guards (see SyncGuards). The old single "syncSource" mode was
  // sticky: it relied on onMomentumScrollEnd, which non-animated scrolls
  // never fire and late viewability events could out-race, wedging the sync.
  // These are one-shot and time-bounded instead. Refs are only touched inside
  // effects and event handlers (never during render).
  const snapInFlight = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const lastReportedKey = useRef<string | null>(null);
  const onActiveRef = useRef(onActive);
  const planSnap = useRef<ReturnType<typeof makeSnapPlanner> | null>(null);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  const endSnap = useCallback(() => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = null;
    snapInFlight.current = false;
  }, []);

  // The timeout is a fallback: animated snaps normally end via
  // onMomentumScrollEnd, but non-animated realigns fire no momentum events.
  const beginSnap = useCallback(
    (ms: number) => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapInFlight.current = true;
      snapTimer.current = setTimeout(endSnap, ms);
    },
    [endSnap],
  );

  useEffect(() => endSnap, [endSnap]);

  // Referentially stable (FlatList mandate); the guard refs are read at event
  // time, never during render.
  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken<CarouselItem>[] }) => {
      makeViewabilityHandler(
        { snapInFlight, activeKey: activeKeyRef, lastReportedKey },
        onActiveRef,
      )(info);
    },
    [],
  );

  // Selection→carousel: snap only when the selected *item* changes (pin tap /
  // external selection). An index shift for the same item means the data
  // reordered under a refetch — realign without animation so the carousel
  // never visibly scrolls on its own. Decision logic lives in makeSnapPlanner.
  useEffect(() => {
    planSnap.current ??= makeSnapPlanner({ lastReportedKey });
    const action = planSnap.current(activeKey, activeIndex);
    if (action === "hold") return;
    const animated = action === "snap";
    beginSnap(animated ? 700 : 120);
    listRef.current?.scrollToOffset({ offset: activeIndex * interval, animated });
  }, [activeKey, activeIndex, interval, beginSnap]);

  if (items.length === 0) return null;

  return (
    <View className="absolute inset-x-0" style={{ bottom: bottomInset + 12 }}>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={itemKey}
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: H_PADDING, gap: GAP }}
        getItemLayout={(_, index) => ({ length: interval, offset: interval * index, index })}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={endSnap}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => (
          <CarouselCard
            item={item}
            width={cardWidth}
            active={itemKey(item) === activeKey}
            onPress={() => onOpen(item)}
          />
        )}
      />
    </View>
  );
}

function CarouselCard({
  item,
  width,
  active,
  onPress,
}: {
  item: CarouselItem;
  width: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        item.kind === "yard"
          ? `Yard: ${item.yard.name}`
          : `Listing: ${item.listing.title}`
      }
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-lg border bg-surface-card p-3 shadow-lg ${
        active ? "border-surface-brand" : "border-border"
      }`}
      style={{ width }}
    >
      {item.kind === "listing" ? <ListingCardBody listing={item.listing} /> : <YardCardBody yard={item.yard} />}
    </Pressable>
  );
}

function ListingCardBody({ listing }: { listing: MapSoloListing }) {
  return (
    <>
      {listing.photo ? (
        <Image
          source={{ uri: resolveMediaUrl(listing.photo) }}
          style={{ width: 72, height: 54, borderRadius: 6 }}
        />
      ) : (
        <View
          className="items-center justify-center rounded-md bg-surface-sunken"
          style={{ width: 72, height: 54 }}
        >
          <MonoText className="text-caption text-text-tertiary">No photo</MonoText>
        </View>
      )}
      <View className="flex-1">
        <DisplayText className="text-h3" numberOfLines={1}>
          {listing.title}
        </DisplayText>
        <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
          {CLASS_BY_VALUE[listing.asset_class].label} · {listing.distance_km} km ·{" "}
          {availabilityCaption(listing)}
        </BodyText>
        <View className="mt-0.5 flex-row items-baseline gap-1">
          <Money display={listing.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day from</BodyText>
        </View>
      </View>
    </>
  );
}

function YardCardBody({ yard }: { yard: MapYard }) {
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const availableCount = yard.listings.filter((l) => l.available).length;
  return (
    <>
      {yard.supplier.logo ? (
        <Image
          source={{ uri: resolveMediaUrl(yard.supplier.logo) }}
          style={{ width: 54, height: 54, borderRadius: 6 }}
        />
      ) : (
        <View
          className="items-center justify-center rounded-md bg-surface-inverse"
          style={{ width: 54, height: 54 }}
        >
          <MonoText className="text-body text-text-brand-on-inverse">{initials}</MonoText>
        </View>
      )}
      <View className="flex-1">
        <DisplayText className="text-h3" numberOfLines={1}>
          {yard.name}
        </DisplayText>
        <View className="flex-row items-center gap-1.5">
          <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
            {yard.listing_count} assets · {availableCount} available
          </BodyText>
          <View className="flex-row items-center gap-1">
            {yard.class_mix.slice(0, 3).map((c) => {
              const Glyph = CLASS_GLYPHS[c];
              return <Glyph key={c} size={11} color={tokens.color.colorInk700} />;
            })}
          </View>
        </View>
        <View className="mt-0.5 flex-row items-baseline gap-1">
          <Money display={yard.price_from_display} />
          <BodyText className="text-caption text-text-tertiary">/ day from</BodyText>
        </View>
      </View>
      <BodyText className="text-text-link">Assets →</BodyText>
    </>
  );
}
