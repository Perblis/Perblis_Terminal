import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText, DisplayText, MonoText } from "../../components/ui/text";
import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { guardIntent } from "../../lib/guest-intent";
import { useCreateEnquiry, useStorefront } from "../../lib/queries";
import { resolveMediaUrl } from "../../lib/media";
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

/** S13 Storefront — guest-accessible company profile. */
export default function Storefront() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const { data, isLoading, error } = useStorefront(id ?? null);
  const createEnquiry = useCreateEnquiry();

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

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}>
        {/* Cover */}
        <View className="h-44 bg-surface-inverse">
          {cover ? (
            <Image source={{ uri: resolveMediaUrl(cover) }} style={{ width: "100%", height: 176 }} resizeMode="cover" />
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

        {/* Plate header */}
        <View className="flex-row items-center gap-3 border-b border-border bg-surface-card px-4 py-4">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-surface-inverse">
            {data.logo_url ? (
              <Image source={{ uri: resolveMediaUrl(data.logo_url) }} style={{ width: 56, height: 56 }} />
            ) : (
              <MonoText className="text-h3 text-text-brand-on-inverse">
                {data.business_name.slice(0, 2).toUpperCase()}
              </MonoText>
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <DisplayText className="text-h2" numberOfLines={1}>
                {data.business_name}
              </DisplayText>
              {data.verification_badge ? (
                <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#1D4ED8" }}>
                  <Svg width={12} height={12} viewBox="0 0 24 24">
                    <Path d="M4 12l6 6 10-12" stroke="#FFFFFF" strokeWidth={3.5} fill="none" />
                  </Svg>
                </View>
              ) : null}
            </View>
            <BodyText className="text-body-sm text-text-secondary">Member since {memberSince}</BodyText>
          </View>
        </View>

        {/* Stats strip */}
        <View className="flex-row border-b border-border bg-surface-card">
          {[
            [String(data.live_listings.length), "listings"],
            [String(classes.length), "classes"],
            [String(data.yards.length), "yards"],
          ].map(([n, label]) => (
            <View key={label} className="flex-1 items-center border-r border-border py-3 last:border-r-0">
              <MonoText className="text-h3">{n}</MonoText>
              <BodyText className="text-caption text-text-tertiary">{label}</BodyText>
            </View>
          ))}
        </View>

        {/* About */}
        {data.about ? (
          <View className="border-b border-border bg-surface-card px-4 py-4">
            <BodyText className="text-text-secondary">{data.about}</BodyText>
          </View>
        ) : null}

        {/* Yards row */}
        {data.yards.length > 0 ? (
          <View className="border-b border-border bg-surface-card py-3">
            <BodyText className="px-4 pb-2 text-overline text-text-tertiary">YARDS</BodyText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3 px-4">
                {data.yards.map((yard) => (
                  <Pressable
                    key={yard.id}
                    accessibilityRole="button"
                    onPress={() => router.push("/(tabs)" as never)}
                    className="w-40 rounded-lg border border-border p-3 active:bg-surface-sunken"
                  >
                    <BodyText className="font-sans-medium" numberOfLines={1}>
                      {yard.name}
                    </BodyText>
                    <BodyText className="text-caption text-text-tertiary">
                      {yard.listing_count} assets · view on map →
                    </BodyText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Inventory grid */}
        <View className="px-4 py-3">
          <BodyText className="pb-2 text-overline text-text-tertiary">INVENTORY</BodyText>
          <View className="flex-row flex-wrap justify-between">
            {data.live_listings.map((listing) => (
              <Pressable
                key={listing.id}
                accessibilityRole="button"
                onPress={() => router.push(`/listing/${listing.id}` as never)}
                className="mb-3 w-[48.5%] overflow-hidden rounded-lg border border-border bg-surface-card active:opacity-90"
              >
                {listing.cover_photo_url ? (
                  <Image source={{ uri: resolveMediaUrl(listing.cover_photo_url) }} style={{ width: "100%", height: 96 }} />
                ) : (
                  <View className="h-24 items-center justify-center bg-surface-sunken">
                    <MonoText className="text-caption text-text-tertiary">—</MonoText>
                  </View>
                )}
                <View className="gap-0.5 p-2.5">
                  <BodyText className="text-body-sm font-sans-medium" numberOfLines={1}>
                    {listing.title}
                  </BodyText>
                  <BodyText className="text-caption text-text-tertiary" numberOfLines={1}>
                    {CLASS_BY_VALUE[listing.asset_class].label}
                  </BodyText>
                  <MonoText className="text-body-sm">{listing.daily_price_display} / day</MonoText>
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
