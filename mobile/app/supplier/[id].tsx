import { tokens } from "@terminal/tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, type ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StaticMiniMap } from "../../components/map/terminal-map";
import { FacilityCard } from "../../components/storefront/facility-card";
import { EmptyState } from "../../components/ui/empty-state";
import { RemoteImage } from "../../components/ui/remote-image";
import { BodyText, DisplayText, MonoText } from "../../components/ui/text";
import { assetNoun, countNoun } from "../../lib/asset-noun";
import { sharedCapabilities } from "../../lib/capabilities";
import { guardIntent } from "../../lib/guest-intent";
import { resolveMediaUrl } from "../../lib/media";
import { FACILITY_SPEC_CAP, useCreateEnquiry, useFacilitySpecs, useStorefront } from "../../lib/queries";
import { useThemeTokens } from "../../lib/theme";
import type { StorefrontListing, StorefrontYard } from "../../lib/types";
import { useMapState } from "../../stores/map-state";
import { useSession } from "../../stores/session";

function CornerMarks() {
  // M4 registration marks — sanctioned on hero imagery only, and the
  // storefront cover is named as one (01 §2).
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
 *  label (02 §3) — the tick alone would be decoration. */
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

/** "3 facilities · 1 location · Verified" — figures in mono, dots drawn
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

/** A counted fact: mono figure, quiet noun. */
function CountFact({ text }: { text: string }) {
  const [figure, ...rest] = text.split(" ");
  return (
    <View className="flex-row items-center gap-1">
      <MonoText className="text-mono-sm text-text-secondary">{figure}</MonoText>
      <BodyText className="text-caption text-text-tertiary">{rest.join(" ")}</BodyText>
    </View>
  );
}

/**
 * S13 Storefront — a hirer's route into a supplier's facilities.
 *
 * 2026-08-10, second pass. The first pass put inventory above the company
 * biography; it still could not answer "which of these is right for me",
 * because every card said only what the thing was called, roughly how big it
 * was, and what it cost. Three cold rooms looked interchangeable.
 *
 * This pass makes the facilities the product and the company the trust layer:
 * facilities → capabilities → trust → supplier → location. Cards carry the
 * specs a hirer actually chooses on (temperature, floor area, backup power,
 * dock levellers, per-facility tier), read from GET /listings/{id} — the
 * storefront payload has none of it, and this is a presentation pass, so the
 * app reads the public per-listing endpoint rather than changing a contract.
 */
export default function Storefront() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const { data, isLoading, error } = useStorefront(id ?? null);
  const createEnquiry = useCreateEnquiry();
  const requestFocus = useMapState((s) => s.requestFocus);
  const theme = useThemeTokens();

  // GET /storefronts/{id} runs no ORDER BY and Listing declares no Meta
  // ordering, so live_listings arrives in Postgres heap order and can change
  // between two reads of the same storefront. ids are UUIDv7, so sorting them
  // lexicographically is creation order — stable, and free.
  const facilities: StorefrontListing[] = useMemo(
    () => [...(data?.live_listings ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    [data?.live_listings],
  );
  // Specs ride the storefront payload since D-030, so this normally fetches
  // nothing. It stays as a self-disabling fallback: against an API older than
  // that decision (production deploys are manual and can lag `main`) the
  // listings arrive without `specs` and are read individually, exactly as
  // before. Once the payload carries them the id list is empty and the hook
  // issues zero requests.
  const specIds = useMemo(
    () =>
      facilities
        .filter((l) => l.specs === undefined)
        .slice(0, FACILITY_SPEC_CAP)
        .map((l) => l.id),
    [facilities],
  );
  const { byId, settled } = useFacilitySpecs(specIds);

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

  const cover = facilities.find((l) => l.cover_photo_url)?.cover_photo_url ?? "";
  const memberSince = new Date(data.member_since).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  const yards: StorefrontYard[] = data.yards;
  const soleYard = yards.length === 1 ? yards[0] : null;
  const noun = assetNoun(facilities.map((l) => l.asset_class));

  // The subline may only name a yard when every facility is actually in it:
  // yard_id is nullable and the payload includes yards with no live listings.
  const allInSoleYard =
    soleYard !== null && facilities.length > 0 && facilities.every((l) => l.yard_id === soleYard.id);

  // Storefront-wide capabilities, stated only when they are true of EVERY
  // facility on the page — so it needs specs for all of them, whether they came
  // on the payload or from the fallback read, and it waits for `settled` so the
  // line can never rewrite itself as late specs arrive.
  const specsFor = (l: StorefrontListing) => l.specs ?? byId.get(l.id)?.specs;
  const shared =
    settled && allInSoleYard && facilities.every((l) => specsFor(l) !== undefined)
      ? sharedCapabilities(facilities.map((l) => ({ asset_class: l.asset_class, specs: specsFor(l) })))
      : [];

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
        {/* Cover — 150dp. It establishes the trade; the facilities below do the
            selling, and every dp here is a dp they lose. */}
        <View className="h-[150px] bg-surface-chrome">
          {cover ? (
            <RemoteImage uri={resolveMediaUrl(cover)} style={{ width: "100%", height: 150 }} />
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

        {/* Supplier identity — compact, borderless, and above all short: it is
            context for the facilities, not the subject of the page. */}
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
                <CountFact text={countNoun(facilities.length, noun)} />
                {yards.length > 0 ? (
                  <CountFact text={`${yards.length} ${yards.length === 1 ? "location" : "locations"}`} />
                ) : null}
                {data.verification_badge ? <VerifiedMark /> : null}
              </MetaLine>
            </View>
          </View>

          {/* Where they are — the page's only tap-through to the map. */}
          {soleYard ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${soleYard.name} on the map`}
              onPress={() => openYardOnMap(soleYard)}
              hitSlop={{ top: 6, bottom: 6 }}
              className="flex-row items-center gap-1.5 active:opacity-70"
            >
              <PinGlyph color={theme["--text-tertiary"]} />
              <BodyText className="shrink text-body-sm text-text-secondary" numberOfLines={1}>
                {soleYard.name}
              </BodyText>
              <BodyText className="text-body-sm text-text-link">· View on map →</BodyText>
            </Pressable>
          ) : null}
        </View>

        {/* Several locations still need their own row, but as pills rather than
            176dp bordered cards. */}
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
                    accessibilityLabel={`View ${yard.name} on the map, ${yard.listing_count} ${yard.listing_count === 1 ? noun.one : noun.many}`}
                    onPress={() => openYardOnMap(yard)}
                    hitSlop={{ top: 8, bottom: 8 }}
                    className="h-9 flex-row items-center gap-1.5 rounded-full bg-surface-sunken px-3.5 active:bg-surface-card"
                  >
                    <PinGlyph color={theme["--text-tertiary"]} />
                    <BodyText className="text-body-sm text-text-primary" numberOfLines={1}>
                      {yard.name}
                    </BodyText>
                    <MonoText className="text-mono-sm text-text-tertiary">{yard.listing_count}</MonoText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* The facilities — the reason the page exists. */}
        <View className="mt-5 px-4">
          <View className="gap-0.5 pb-3">
            <SectionLabel>AVAILABLE TO HIRE</SectionLabel>
            {facilities.length > 0 ? (
              <BodyText className="text-caption text-text-tertiary">
                {countNoun(facilities.length, noun)}
                {allInSoleYard ? ` · ${soleYard.name}` : ""}
              </BodyText>
            ) : null}
          </View>

          {facilities.length > 0 ? (
            facilities.map((listing) => (
              <FacilityCard key={listing.id} listing={listing} spec={byId.get(listing.id)} noun={noun} />
            ))
          ) : (
            <EmptyState
              title={`No live ${noun.many}`}
              body="This company has nothing listed right now."
              compact
            />
          )}

          {/* What holds true across every facility here — stated once instead
              of repeated on each card. */}
          {shared.length >= 3 ? (
            <View className="gap-1 border-t border-border-default pt-4">
              <SectionLabel>{`ACROSS ALL ${noun.many.toUpperCase()}`}</SectionLabel>
              <BodyText className="text-body-sm leading-5 text-text-secondary">
                {shared.slice(0, 5).join(" · ")}
              </BodyText>
            </View>
          ) : null}
        </View>

        {/* About — kept, demoted. A rule rather than a box: a footnote to the
            facilities, not a panel competing with them. */}
        <View className="mx-4 mt-5 gap-2 border-t border-border-default pt-5">
          {data.about ? (
            <>
              <SectionLabel>ABOUT</SectionLabel>
              <BodyText className="leading-6 text-text-secondary">{data.about}</BodyText>
            </>
          ) : null}
          <BodyText className="text-caption text-text-tertiary">Member since {memberSince}</BodyText>
        </View>

        {/* Where, in context. Informational only — the header line above owns
            the tap-through, so there is one map affordance, not two. */}
        {soleYard ? (
          <View className="mx-4 mt-5 gap-2 border-t border-border-default pt-5">
            <SectionLabel>LOCATION</SectionLabel>
            <BodyText className="text-body-sm text-text-secondary">{soleYard.name}</BodyText>
            <View className="overflow-hidden rounded-lg">
              <StaticMiniMap
                lng={soleYard.point.coordinates[0]}
                lat={soleYard.point.coordinates[1]}
                height={150}
              />
            </View>
            <BodyText className="text-caption text-text-tertiary">
              Approximate area shown. The exact address unlocks when your hire is confirmed.
            </BodyText>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky enquiry CTA (guest → auth sheet preserving intent). The
          facilities are the call to action; this is how you ask a question, so
          it stays a 48dp self-sized pill rather than a full-width slab. */}
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
