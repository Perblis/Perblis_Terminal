import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Share, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Gallery } from "../../components/listing/gallery";
import { SpecTable } from "../../components/listing/spec-table";
import { StaticMiniMap } from "../../components/map/terminal-map";
import { TierBadge } from "../../components/search/listing-row";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText, DisplayText, Money, MonoText } from "../../components/ui/text";
import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { guardIntent } from "../../lib/guest-intent";
import { resolveMediaUrl } from "../../lib/media";
import { useListing, useSpecTemplate } from "../../lib/queries";
import { useSession } from "../../stores/session";

function PriceCell({ label, display }: { label: string; display: string | null }) {
  if (!display) return null;
  return (
    <View className="flex-1 items-center gap-0.5 py-3">
      <Money display={display} className="text-mono-lg" />
      <BodyText className="text-caption text-text-tertiary">/ {label}</BodyText>
    </View>
  );
}

/** S6 Listing Detail — the asset's showroom (guest-readable when Live). */
export default function ListingDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const { data: listing, isLoading, error } = useListing(id ?? null);
  const { data: template } = useSpecTemplate(
    listing?.asset_class ?? null,
    listing?.asset_type ?? null,
    listing?.spec_template_version ?? null,
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-page">
        <View className="bg-surface-sunken" style={{ height: 260 }} />
        <View className="gap-3 p-4">
          {[220, 160, 300].map((w) => (
            <View key={w} className="h-5 rounded bg-surface-sunken" style={{ width: w }} />
          ))}
        </View>
      </View>
    );
  }

  // Dead link: removed/paused/archived listings 404 for the public.
  if (error || !listing || listing.status !== "live") {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <EmptyState
          title="No longer available"
          body="This asset was paused or removed. Similar machines are on the map."
        />
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)" as never)} className="pb-8">
          <BodyText className="text-text-link">← Back to the map</BodyText>
        </Pressable>
      </View>
    );
  }

  const meta = CLASS_BY_VALUE[listing.asset_class];
  const [lng, lat] = listing.point?.coordinates ?? [null, null];

  const protectedAction = (intent: string, go: () => void) => {
    const gate = guardIntent(me !== null, intent);
    if (!gate.proceed) {
      router.push(gate.authHref);
      return;
    }
    go();
  };

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <Gallery photos={listing.photos} topInset={insets.top} />

        {/* Back + share overlay */}
        <View className="absolute inset-x-3 flex-row justify-between" style={{ top: insets.top + 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <DisplayText className="text-h3" style={{ color: "#FFFFFF" }}>
              ←
            </DisplayText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share"
            onPress={() =>
              void Share.share({ message: `${listing.title} on Terminal — ₦ from ${listing.daily_price_display}/day` })
            }
            className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M12 3v13M7 8l5-5 5 5M5 13v7h14v-7" stroke="#FFFFFF" strokeWidth={2} fill="none" />
            </Svg>
          </Pressable>
        </View>

        <View className="gap-4 p-4">
          {/* Title block */}
          <View className="gap-1.5">
            <View className="flex-row items-start gap-2">
              <DisplayText className="flex-1 text-h1">{listing.title}</DisplayText>
              <TierBadge tier={listing.tier} />
            </View>
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1">
                <View className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <BodyText className="text-caption text-text-secondary">{meta.label}</BodyText>
              </View>
              <BodyText className="text-caption text-text-tertiary">{listing.asset_type}</BodyText>
              {listing.city ? (
                <BodyText className="text-caption text-text-tertiary">· {listing.city}</BodyText>
              ) : null}
            </View>
          </View>

          {/* Supplier card → S13 */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/supplier/${listing.supplier_id}` as never)}
            className="flex-row items-center gap-3 rounded-lg border border-border bg-surface-card p-3 active:bg-surface-sunken"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-inverse">
              <MonoText style={{ color: "#F59E0B" }}>{listing.title.slice(0, 1).toUpperCase()}</MonoText>
            </View>
            <View className="flex-1">
              <BodyText className="font-sans-medium">View company profile</BodyText>
              <BodyText className="text-caption text-text-tertiary">All listings, yards and details</BodyText>
            </View>
            <BodyText className="text-text-link">→</BodyText>
          </Pressable>

          {/* Description */}
          {listing.description ? (
            <BodyText className="text-text-secondary">{listing.description}</BodyText>
          ) : null}

          {/* SpecTable */}
          <View className="gap-2">
            <BodyText className="text-overline text-text-tertiary">SPECIFICATIONS</BodyText>
            <SpecTable specs={listing.specs} template={template} />
          </View>

          {/* Pricing grid + best-price hint */}
          <View className="gap-2">
            <BodyText className="text-overline text-text-tertiary">PRICING</BodyText>
            <View className="flex-row divide-x divide-border rounded-lg border border-border bg-surface-card">
              <PriceCell label="day" display={listing.daily_price_display} />
              <PriceCell label="week" display={listing.weekly_price_display} />
              <PriceCell label="month" display={listing.monthly_price_display} />
            </View>
            {listing.weekly_price_display || listing.monthly_price_display ? (
              <BodyText className="text-caption text-text-tertiary">
                Longer hires use the cheapest rate automatically — you always pay the best price.
              </BodyText>
            ) : null}
          </View>

          {/* Location — privacy radius until Confirmed */}
          {lng !== null && lat !== null ? (
            <View className="gap-2">
              <BodyText className="text-overline text-text-tertiary">LOCATION</BodyText>
              <StaticMiniMap lng={lng} lat={lat} />
              <BodyText className="text-caption text-text-tertiary">
                Approximate area shown. The exact address unlocks when your hire is confirmed.
              </BodyText>
            </View>
          ) : null}

          {/* Cancellation summary strip (§7.6 vocabulary, no figures) */}
          <View className="rounded-lg border border-border bg-surface-sunken px-3.5 py-3">
            <BodyText className="text-body-sm text-text-secondary">
              Free cancellation until you pay. After payment, refunds follow the notice ladder — a
              full preview shows before you ever cancel.
            </BodyText>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action zone */}
      <View
        className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-border bg-surface-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-1">
          <Button
            variant="secondary"
            label="Enquire"
            onPress={() =>
              protectedAction(`/listing/${listing.id}`, () => router.push("/(tabs)/messages" as never))
            }
          />
        </View>
        <View className="flex-[1.4]">
          <Button
            label="Request to hire"
            onPress={() =>
              protectedAction(`/hire-request/${listing.id}`, () =>
                router.push(`/hire-request/${listing.id}` as never),
              )
            }
          />
        </View>
      </View>
    </View>
  );
}
