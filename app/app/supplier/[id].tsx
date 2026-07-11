import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText, DisplayText, Money, MonoText } from "../../components/ui/text";
import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { guardIntent } from "../../lib/guest-intent";
import { useCreateEnquiry, useStorefront } from "../../lib/queries";
import { resolveMediaUrl } from "../../lib/media";
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

/** S13 Storefront — guest-accessible company profile. */
export default function Storefront() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const { data, isLoading, error } = useStorefront(id ?? null);
  const createEnquiry = useCreateEnquiry();
  const requestFocus = useMapState((s) => s.requestFocus);

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
  const classes = [...new Set(data.live_listings.map((l) => l.asset_class))];
  const memberSince = new Date(data.member_since).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

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

  const openYardOnMap = (yard: (typeof data.yards)[number]) => {
    const [lng, lat] = yard.point.coordinates;
    requestFocus({ centerLng: lng, centerLat: lat, zoom: 14 });
    router.push("/(tabs)" as never);
  };

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 92 }}>
        {/* Cover */}
        <View className="h-52 bg-surface-inverse">
          {cover ? (
            <Image source={{ uri: resolveMediaUrl(cover) }} style={{ width: "100%", height: 208 }} resizeMode="cover" />
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

        {/* Identity plate — overlaps the cover so the page breathes */}
        <View className="-mt-8 mx-4 rounded-xl border border-border bg-surface-card p-4 shadow-sm">
          <View className="flex-row items-center gap-3.5">
            <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-surface-inverse">
              {data.logo_url ? (
                <Image source={{ uri: resolveMediaUrl(data.logo_url) }} style={{ width: 64, height: 64 }} />
              ) : (
                <MonoText className="text-h3 text-text-brand-on-inverse">
                  {data.business_name.slice(0, 2).toUpperCase()}
                </MonoText>
              )}
            </View>
            <View className="flex-1 gap-1">
              <DisplayText className="text-h2" numberOfLines={2}>
                {data.business_name}
              </DisplayText>
              <View className="flex-row flex-wrap items-center gap-2">
                {data.verification_badge ? (
                  <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: "#1D4ED8" }}>
                    <Svg width={10} height={10} viewBox="0 0 24 24">
                      <Path d="M4 12l6 6 10-12" stroke="#FFFFFF" strokeWidth={3.5} fill="none" />
                    </Svg>
                    <BodyText className="text-caption" style={{ color: "#FFFFFF" }}>
                      Verified
                    </BodyText>
                  </View>
                ) : null}
                <BodyText className="text-caption text-text-tertiary">Member since {memberSince}</BodyText>
              </View>
            </View>
          </View>

          {/* Stats — quiet rules, mono numbers */}
          <View className="mt-4 flex-row rounded-lg bg-surface-sunken py-3">
            {(
              [
                [String(data.live_listings.length), data.live_listings.length === 1 ? "listing" : "listings"],
                [String(classes.length), classes.length === 1 ? "class" : "classes"],
                [String(data.yards.length), data.yards.length === 1 ? "yard" : "yards"],
              ] as const
            ).map(([n, label], i) => (
              <View key={label} className={`flex-1 items-center ${i > 0 ? "border-l border-border" : ""}`}>
                <MonoText className="text-h2">{n}</MonoText>
                <BodyText className="text-caption text-text-tertiary">{label}</BodyText>
              </View>
            ))}
          </View>
        </View>

        {/* About */}
        {data.about ? (
          <View className="mx-4 mt-4 gap-2 rounded-xl border border-border bg-surface-card p-4">
            <SectionLabel>ABOUT</SectionLabel>
            <BodyText className="leading-6 text-text-secondary">{data.about}</BodyText>
          </View>
        ) : null}

        {/* Yards */}
        {data.yards.length > 0 ? (
          <View className="mt-5 gap-2.5">
            <View className="px-4">
              <SectionLabel>YARDS</SectionLabel>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3 px-4">
                {data.yards.map((yard) => (
                  <Pressable
                    key={yard.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${yard.name} on the map`}
                    onPress={() => openYardOnMap(yard)}
                    className="w-44 gap-1 rounded-xl border border-border bg-surface-card p-3.5 active:bg-surface-sunken"
                  >
                    <BodyText className="font-sans-medium" numberOfLines={1}>
                      {yard.name}
                    </BodyText>
                    <BodyText className="text-caption text-text-tertiary">
                      {yard.listing_count} asset{yard.listing_count === 1 ? "" : "s"}
                    </BodyText>
                    <BodyText className="mt-1 text-caption text-text-link">View on map →</BodyText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Inventory */}
        <View className="mt-5 gap-2.5 px-4">
          <SectionLabel>INVENTORY</SectionLabel>
          <View className="flex-row flex-wrap justify-between">
            {data.live_listings.map((listing) => (
              <Pressable
                key={listing.id}
                accessibilityRole="button"
                onPress={() => router.push(`/listing/${listing.id}` as never)}
                className="mb-3 w-[48.5%] overflow-hidden rounded-xl border border-border bg-surface-card active:opacity-90"
              >
                {listing.cover_photo_url ? (
                  <Image source={{ uri: resolveMediaUrl(listing.cover_photo_url) }} style={{ width: "100%", height: 108 }} />
                ) : (
                  <View className="h-[108px] items-center justify-center bg-surface-sunken">
                    <MonoText className="text-caption text-text-tertiary">—</MonoText>
                  </View>
                )}
                <View className="gap-1 p-3">
                  <BodyText className="text-body-sm font-sans-medium" numberOfLines={1}>
                    {listing.title}
                  </BodyText>
                  <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
                    {CLASS_BY_VALUE[listing.asset_class].label}
                  </BodyText>
                  <View className="flex-row items-baseline gap-1 pt-0.5">
                    <Money display={listing.daily_price_display} />
                    <BodyText className="text-caption text-text-tertiary">/ day</BodyText>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          {data.live_listings.length === 0 ? (
            <EmptyState title="No live listings" body="This company has nothing listed right now." compact />
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky message CTA (guest → auth sheet preserving intent) */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-border bg-surface-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button label={`Message ${data.business_name}`} busy={createEnquiry.isPending} onPress={message} />
      </View>
    </View>
  );
}
