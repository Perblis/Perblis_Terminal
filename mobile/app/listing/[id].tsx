import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Gallery } from "../../components/listing/gallery";
import { ReportSheet } from "../../components/listing/report-sheet";
import { SpecTable } from "../../components/listing/spec-table";
import { StaticMiniMap } from "../../components/map/terminal-map";
import { TierBadge } from "../../components/search/listing-row";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { RemoteImage } from "../../components/ui/remote-image";
import { BodyText, DisplayText, Money, MonoText } from "../../components/ui/text";
import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { guardIntent } from "../../lib/guest-intent";
import { splitListingTitle } from "../../lib/listing-title";
import { resolveMediaUrl } from "../../lib/media";
import { useCreateEnquiry, useListing, useSpecTemplate, useStorefront } from "../../lib/queries";
import { useSession } from "../../stores/session";

/** Secondary rate (week/month). The day rate is the hero and renders inline. */
function RateCell({ label, display }: { label: string; display: string | null }) {
  if (!display) return null;
  return (
    <View className="gap-0.5">
      <BodyText className="text-overline uppercase text-text-tertiary">{label}</BodyText>
      <Money display={display} />
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
  // Public read; the company name is not on the listing payload (§12).
  const { data: storefront } = useStorefront(listing?.supplier_id ?? null);
  const createEnquiry = useCreateEnquiry();
  const [reportOpen, setReportOpen] = useState(false);

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
  const { name, qualifier } = splitListingTitle(listing.title);

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
          <View className="flex-row gap-2">
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report listing"
              onPress={() => setReportOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
            >
              <DisplayText className="text-h3" style={{ color: "#FFFFFF" }}>
                ⋯
              </DisplayText>
            </Pressable>
          </View>
        </View>

        <View className="gap-5 p-4">
          {/* Title block — asset name leads, purpose beneath it. */}
          <View className="gap-1.5">
            <View className="flex-row items-start gap-2">
              <DisplayText className="flex-1 text-h1">{name}</DisplayText>
              <TierBadge tier={listing.tier} />
            </View>
            {qualifier ? (
              <BodyText className="text-body-lg text-text-secondary">{qualifier}</BodyText>
            ) : null}
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

          {/* Supplier card → S13. The listing payload carries only supplier_id,
              so the company NAME comes from the public storefront read — the
              card used to show a generic line and the listing title's first
              letter as an avatar, which told the hirer nothing about who they
              would be hiring from (§12). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              storefront ? `View ${storefront.business_name}'s company profile` : "View company profile"
            }
            onPress={() => router.push(`/supplier/${listing.supplier_id}` as never)}
            className="flex-row items-center gap-3 rounded-lg bg-surface-card p-3 active:bg-surface-sunken"
          >
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-surface-chrome">
              {storefront?.logo_url ? (
                <RemoteImage
                  uri={resolveMediaUrl(storefront.logo_url)}
                  style={{ width: 40, height: 40 }}
                />
              ) : (
                <MonoText className="text-text-brand-on-inverse">
                  {(storefront?.business_name ?? listing.title).slice(0, 1).toUpperCase()}
                </MonoText>
              )}
            </View>
            <View className="flex-1">
              <BodyText className="font-sans-medium" numberOfLines={1}>
                {storefront?.business_name ?? "View company profile"}
              </BodyText>
              <BodyText className="text-caption text-text-tertiary">
                All listings, yards and details
              </BodyText>
            </View>
            <BodyText className="text-text-link">→</BodyText>
          </Pressable>

          {/* Description */}
          {listing.description ? (
            <BodyText className="text-text-secondary">{listing.description}</BodyText>
          ) : null}

          {/* SpecTable — two-column grid, no outer box */}
          <View>
            <BodyText className="text-overline text-text-tertiary">SPECIFICATIONS</BodyText>
            <SpecTable specs={listing.specs} template={template} />
          </View>

          {/* Pricing — the day rate is the hero; longer rates support it.
              Spacing and type carry the hierarchy, so no cell grid, no box. */}
          <View className="gap-3">
            <BodyText className="text-overline text-text-tertiary">PRICING</BodyText>
            {listing.daily_price_display ? (
              <View className="flex-row items-baseline gap-1.5">
                <Money display={listing.daily_price_display} className="text-money-md" />
                <BodyText className="text-body text-text-secondary">/ day</BodyText>
              </View>
            ) : null}
            {listing.weekly_price_display || listing.monthly_price_display ? (
              <>
                <View className="flex-row gap-10">
                  <RateCell label="per week" display={listing.weekly_price_display} />
                  <RateCell label="per month" display={listing.monthly_price_display} />
                </View>
                <BodyText className="text-caption text-text-tertiary">
                  Longer hires use the cheapest rate automatically — you always pay the best price.
                </BodyText>
              </>
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

          {/* Cancellation summary strip (§7.6 vocabulary, no figures) — a rule
              rather than a box; it is a footnote, not a panel. */}
          <View className="border-t border-border-default pt-4">
            <BodyText className="text-body-sm text-text-tertiary">
              Free cancellation until you pay. After payment, refunds follow the notice ladder — a
              full preview shows before you ever cancel.
            </BodyText>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action zone. The two actions were a matched pair of verbs with
          nothing to tell them apart — sublabels now say what each one commits
          you to, and the primary carries the price so the number is on screen
          at the moment of decision (§6/§7). "Enquire" is the Lexicon's term
          (02 §Enquiry, industry-native) and stays; the caption does the
          explaining instead of a rename. */}
      <View
        className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-border-default bg-surface-card px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-1">
          <Button
            variant="secondary"
            label="Enquire"
            sublabel="Ask a question first"
            busy={createEnquiry.isPending}
            onPress={() =>
              protectedAction(`/listing/${listing.id}`, () =>
                createEnquiry.mutate(
                  { listing_id: listing.id },
                  { onSuccess: (conv) => router.push(`/messages/${conv.id}` as never) },
                ),
              )
            }
          />
        </View>
        <View className="flex-[1.4]">
          <Button
            label="Request to hire"
            sublabel={
              listing.daily_price_display ? `${listing.daily_price_display} / day` : undefined
            }
            onPress={() =>
              protectedAction(`/hire-request/${listing.id}`, () =>
                router.push(`/hire-request/${listing.id}` as never),
              )
            }
          />
        </View>
      </View>

      <ReportSheet listingId={listing.id} visible={reportOpen} onClose={() => setReportOpen(false)} />
    </View>
  );
}
