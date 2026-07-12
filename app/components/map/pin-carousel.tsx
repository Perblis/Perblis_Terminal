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

/** The swipe→select half of the sync, factored pure for tests: activates the
 *  focused card unless a programmatic pin→card snap is in flight. */
export function makeViewabilityHandler(
  syncSource: { current: "pin" | "swipe" | null },
  onActive: { current: (item: CarouselItem) => void },
) {
  return ({ viewableItems }: { viewableItems: ViewToken<CarouselItem>[] }) => {
    if (syncSource.current === "pin") return;
    const focused = viewableItems.find((v) => v.isViewable);
    if (focused?.item) {
      syncSource.current = "swipe";
      onActive.current(focused.item);
    }
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
  // "pin": a programmatic snap is in flight — viewability callbacks must not
  // re-select (the feedback-loop guard). Cleared when the scroll settles.
  const syncSource = useRef<"pin" | "swipe" | null>(null);
  const cardWidth = Dimensions.get("window").width - H_PADDING * 2 - 24;
  const interval = cardWidth + GAP;

  const activeKey = selectionKey(selection);
  const activeIndex = useMemo(
    () => (activeKey ? items.findIndex((it) => itemKey(it) === activeKey) : -1),
    [items, activeKey],
  );

  // Pin tap (or external selection): snap the carousel to the matching card.
  useEffect(() => {
    if (activeIndex < 0 || syncSource.current === "swipe") return;
    syncSource.current = "pin";
    listRef.current?.scrollToIndex({ index: activeIndex, animated: true, viewPosition: 0.5 });
  }, [activeIndex]);

  // The viewability callback must be referentially stable (FlatList mandate);
  // route the latest onActive through a ref instead.
  const onActiveRef = useRef(onActive);
  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  // The factory only stores the ref boxes; .current is read at event time,
  // never during render — safe despite the react-hooks/refs heuristic.
  const onViewableItemsChanged = useMemo(
    // eslint-disable-next-line react-hooks/refs
    () => makeViewabilityHandler(syncSource, onActiveRef),
    [],
  );

  const onMomentumScrollEnd = useCallback(() => {
    syncSource.current = null;
  }, []);

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
        onScrollToIndexFailed={() => {}}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={onMomentumScrollEnd}
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
