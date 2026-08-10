import { tokens } from "@terminal/tokens";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, type ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "../../components/ui/empty-state";
import { RemoteImage } from "../../components/ui/remote-image";
import { BodyText, DisplayText, Money, MonoText } from "../../components/ui/text";
import { guardIntent } from "../../lib/guest-intent";
import { listingCardSpec } from "../../lib/listing-spec";
import { resolveMediaUrl } from "../../lib/media";
import { useCreateEnquiry, useStorefront } from "../../lib/queries";
import { useThemeTokens } from "../../lib/theme";
import type { StorefrontListing, StorefrontYard } from "../../lib/types";
import { useMapState } from "../../stores/map-state";
import { useSession } from "../../stores/session";

function CornerMarks() {
  // M4 registration marks on the cover (01 §2).
  const arm = "M1 13 V1 H13";
  return (
    <View className="absolute inset-2" pointerEvents="none">
      {(["0deg", "90deg", "180deg", "270deg"] as const).map((rot, i) => (
        <View
          key={rot}
          className="absolute"
          style={{
            transform: [{ rotate: rot }],
            ...(i === 0 && { left: 0, top: 0 }),
            ...(i === 1 && { right: 0, top: 0 }),
            ...(i === 2 && { right: 0, bottom: 0 }),
            ...(i === 3 && { left: 0, bottom: 0 }),
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d={arm} stroke="rgba(22,24,29,0.6)" strokeWidth={1.5} fill="none" />
          </Svg>
        </View>
      ))}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <BodyText className="text-overline tracking-widest text-text-tertiary">{children}</BodyText>;
}

/** Account-level verification, inline in the header meta line. Colour PLUS
 *  label (02 §3) — the tick alone would be decoration. The stroke reads the
 *  ramp token rather than the literal hex the old badge carried. */
function VerifiedMark() {
  return (
    <View className="flex-row items-center gap-1">
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Path d="M4 12l6 6 10-12" stroke={tokens.color.colorBlue400} strokeWidth={3.5} fill="none" />
      </Svg>
      <BodyText className="text-caption text-blue-400">Verified</BodyText>
    </View>
  );
}

/** Location marker. SVG props are outside NativeWind's reach, so the colour
 *  comes in as a token value (lib/theme) — never a hex at the call site. */
function PinGlyph({ color }: { color: ColorValue }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M12 22s7-7.2 7-12a7 7 0 10-14 0c0 4.8 7 12 7 12z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Circle cx={12} cy={10} r={2.4} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

/** The header's answer to "how much of a supplier is this" — "3 listings ·
 *  1 location · Verified". Figures in mono, the rest quiet; dots are drawn
 *  between segments rather than baked into each label. */
function MetaLine({ children }: { children: ReactNode[] }) {
  const parts = children.filter(Boolean);
  return (
    <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
      {parts.map((part, i) => (
        <View key={i} className="flex-row items-center gap-x-1.5">
          {i > 0 ? <BodyText className="text-caption text-text-tertiary">·</BodyText> : null}
          {part}
        </View>
      ))}
    </View>
  );
}

/** A counted fact: mono figure, quiet noun ("3 listings"). */
function CountFact({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <MonoText className="text-mono-sm text-text-secondary">{n}</MonoText>
      <BodyText className="text-caption text-text-tertiary">{n === 1 ? one : many}</BodyText>
    </View>
  );
}

/**
 * One asset, two-up. What a hirer scans, in order: the picture, what it is, the
 * one spec that separates it from the next machine, the day rate.
 *
 * De-boxed (07 §11): the photo's own edge is the card's edge, so there is no
 * border and no second surface inside the page — the storefront used to nest a
 * bordered card inside a bordered section inside a bordered plate.
 */
function ListingCard({ listing }: { listing: StorefrontListing }) {
  const { name, spec, figure } = listingCardSpec(listing);
  const SpecText = figure ? MonoText : BodyText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${spec}, ${listing.daily_price_display} a day`}
      onPress={() => router.push(`/listing/${listing.id}` as never)}
      className="mb-5 w-[48.5%] active:opacity-80"
    >
      {listing.cover_photo_url ? (
        <RemoteImage
          uri={resolveMediaUrl(listing.cover_photo_url)}
          style={{ width: "100%", height: 112, borderRadius: 8 }}
          recyclingKey={listing.id}
        />
      ) : (
        <View className="h-28 items-center justify-center rounded-lg bg-surface-sunken">
          <MonoText className="text-caption text-text-tertiary">—</MonoText>
        </View>
      )}
      <View className="gap-0.5 pt-2">
        <BodyText className="text-body-sm font-sans-medium" numberOfLines={1}>
          {name}
        </BodyText>
        {/* The spec, not the class: "8 m³" beats "Plant & Machinery", which is
            identical on every card of a single-class storefront. */}
        <SpecText
          className={`${figure ? "text-mono-sm" : "text-caption"} text-text-secondary`}
          numberOfLines={1}
        >
          {spec}
        </SpecText>
        <View className="flex-row items-baseline gap-1 pt-0.5">
          <Money display={listing.daily_price_display} />
          <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * S13 Storefront — a supplier's shop, not their company record.
 *
 * 2026-08-10 information-architecture pass. It read as a profile page: an
 * identity plate carrying a three-cell "3 listings / 1 class / 1 yard" counter
 * (two of those three are constants on a small storefront), then About, then a
 * horizontal rail of bordered Yard cards, and only then — below three boxed
 * sections — the actual inventory. A hirer arriving from a pin had to scroll
 * past the company's biography to reach the machines.
 *
 * Inverted: the first viewport answers who, where, what and roughly how much.
 * About moves below the assets, the standalone Yards rail collapses into the
 * header when there is one location, and the stat row states marketplace facts
 * instead of counting taxonomy. Presentation only — the same reads, the same
 * enquiry mutation, the same Lexicon.
 */
export default function Storefront() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const { data, isLoading, error } = useStorefront(id ?? null);
  const createEnquiry = useCreateEnquiry();
  const requestFocus = useMapState((s) => s.requestFocus);
  const theme = useThemeTokens();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <EmptyState
          title="This company isn’t available"
          body="The profile may have been removed. Head back to the map to keep browsing."
        />
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="pb-8">
          <BodyText className="text-text-link">← Back</BodyText>
        </Pressable>
      </View>
    );
  }

  const cover = data.live_listings.find((l) => l.cover_photo_url)?.cover_photo_url ?? "";
  const memberSince = new Date(data.member_since).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  const yards: StorefrontYard[] = data.yards;
  const soleYard = yards.length === 1 ? yards[0] : null;

  const message = () => {
    const gate = guardIntent(me !== null, `/supplier/${id}`);
    if (!gate.proceed) {
      router.push(gate.authHref);
      return;
    }
    if (!id || createEnquiry.isPending) return;
    // Get-or-create the general enquiry, then land straight in the thread.
    createEnquiry.mutate(
      { supplier_id: id },
      { onSuccess: (conv) => router.push(`/messages/${conv.id}` as never) },
    );
  };

  const openYardOnMap = (yard: StorefrontYard) => {
    const [lng, lat] = yard.point.coordinates;
    requestFocus({ centerLng: lng, centerLat: lat, zoom: 14 });
    router.push("/(tabs)" as never);
  };

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Cover — 160dp, down from 208. It sets the trade, it does not need a
            third of the first screen to do it. */}
        <View className="h-40 bg-surface-chrome">
          {cover ? (
            <RemoteImage uri={resolveMediaUrl(cover)} style={{ width: "100%", height: 160 }} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <MonoText className="text-body text-text-brand-on-inverse">{data.business_name}</MonoText>
            </View>
          )}
          <CornerMarks />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="absolute left-3 h-10 w-10 items-center justify-center rounded-full bg-surface-card/90"
            style={{ top: insets.top + 4 }}
          >
            <DisplayText className="text-h3">←</DisplayText>
          </Pressable>
        </View>

        {/* Identity — logo, name, and the three facts that matter. No plate, no
            border: it sits on the page ground directly under the cover. */}
        <View className="gap-2.5 px-4 pt-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-surface-chrome">
              {data.logo_url ? (
                <RemoteImage uri={resolveMediaUrl(data.logo_url)} style={{ width: 56, height: 56 }} />
              ) : (
                <MonoText className="text-h3 text-text-brand-on-inverse">
                  {data.business_name.slice(0, 2).toUpperCase()}
                </MonoText>
              )}
            </View>
            <View className="flex-1 gap-1">
              <DisplayText className="text-h1" numberOfLines={2}>
                {data.business_name}
              </DisplayText>
              <MetaLine>
                <CountFact n={data.live_listings.length} one="listing" many="listings" />
                {yards.length > 0 ? (
                  <CountFact n={yards.length} one="location" many="locations" />
                ) : null}
                {data.verification_badge ? <VerifiedMark /> : null}
              </MetaLine>
            </View>
          </View>

          {/* Where they are. One yard is a line in the header, not a card in a
              rail — a single-item horizontal scroller was pure ceremony. */}
          {soleYard ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${soleYard.name} on the map`}
              onPress={() => openYardOnMap(soleYard)}
              hitSlop={{ top: 6, bottom: 6 }}
              className="flex-row items-center gap-1.5 active:opacity-70"
            >
              <PinGlyph color={theme["--text-tertiary"]} />
              {/* Shrinks rather than pushing the link off the row — a long yard
                  name must never cost the hirer the map affordance. */}
              <BodyText className="shrink text-body-sm text-text-secondary" numberOfLines={1}>
                {soleYard.name}
              </BodyText>
              <BodyText className="text-body-sm text-text-link">· View on map →</BodyText>
            </Pressable>
          ) : null}
        </View>

        {/* Two or more locations still need their own row, but as pills rather
            than 176dp bordered cards. */}
        {yards.length > 1 ? (
          <View className="mt-3.5 gap-2">
            <View className="px-4">
              <SectionLabel>LOCATIONS</SectionLabel>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 px-4">
                {yards.map((yard) => (
                  <Pressable
                    key={yard.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${yard.name} on the map, ${yard.listing_count} asset${yard.listing_count === 1 ? "" : "s"}`}
                    onPress={() => openYardOnMap(yard)}
                    hitSlop={{ top: 8, bottom: 8 }}
                    className="h-9 flex-row items-center gap-1.5 rounded-full bg-surface-sunken px-3.5 active:bg-surface-card"
                  >
                    <PinGlyph color={theme["--text-tertiary"]} />
                    <BodyText className="text-body-sm text-text-primary" numberOfLines={1}>
                      {yard.name}
                    </BodyText>
                    <MonoText className="text-mono-sm text-text-tertiary">{yard.listing_count}</MonoText>
                    <BodyText className="text-caption text-text-tertiary">
                      {yard.listing_count === 1 ? "asset" : "assets"}
                    </BodyText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Available to hire — the reason the page exists, so it comes first.
            "Inventory" was warehouse vocabulary for a stock list; this says
            what a hirer can actually do with it. */}
        <View className="mt-5 gap-3 px-4">
          <SectionLabel>AVAILABLE TO HIRE</SectionLabel>
          {data.live_listings.length > 0 ? (
            <View className="flex-row flex-wrap justify-between">
              {data.live_listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </View>
          ) : (
            <EmptyState title="No live listings" body="This company has nothing listed right now." compact />
          )}
        </View>

        {/* About — kept, demoted. A rule rather than a box: it is a footnote to
            the inventory, not a panel competing with it. */}
        <View className="mx-4 mt-1 gap-2 border-t border-border-default pt-5">
          {/* No prose ⇒ no heading: an ABOUT label over nothing but a join date
              is a section pretending to be one. */}
          {data.about ? (
            <>
              <SectionLabel>ABOUT</SectionLabel>
              <BodyText className="leading-6 text-text-secondary">{data.about}</BodyText>
            </>
          ) : null}
          <BodyText className="text-caption text-text-tertiary">Member since {memberSince}</BodyText>
        </View>
      </ScrollView>

      {/* Sticky enquiry CTA (guest → auth sheet preserving intent).
          Deliberately not the full-width primary slab it was: on a storefront
          the assets are the call to action and this is the way to ask a
          question, so it is a 48dp self-sized pill — still brand-filled, still
          ≥48dp (FSD §12), a third of the ink. */}
      <View
        className="absolute inset-x-0 bottom-0 items-center border-t border-border-default bg-surface-card px-4 pt-2.5"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message ${data.business_name}`}
          accessibilityState={{ disabled: createEnquiry.isPending, busy: createEnquiry.isPending }}
          disabled={createEnquiry.isPending}
          onPress={message}
          className="min-h-12 flex-row items-center justify-center gap-2 rounded-md bg-surface-brand px-6 active:opacity-90"
        >
          {createEnquiry.isPending ? (
            <ActivityIndicator size="small" />
          ) : (
            <BodyText className="text-body-sm font-sans-semibold text-text-on-brand" numberOfLines={1}>
              Message {data.business_name}
            </BodyText>
          )}
        </Pressable>
      </View>
    </View>
  );
}
