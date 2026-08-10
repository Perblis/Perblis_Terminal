// S12 filter sheet (2026-08-09, founder: "move advanced filters into a proper
// mobile filter sheet rather than permanently expanding the page").
//
// This is the SAME markup that lived inline in app/search.tsx — moved and
// regrouped, not rebuilt. The state, the ₦→kobo parsing and the query assembly
// all stay in the screen, so filters still apply live and SearchFilters is
// byte-identical. Measured: the inline panel took ~380–440pt of a ~780pt
// viewport, on top of a ~150pt header and an autoFocus keyboard.
//
// It uses the bespoke ui/sheet.tsx WITHOUT snapPoints on purpose: that selects
// the half/full mode, which keeps the tap-to-dismiss scrim. The map's new peek
// mode deliberately has no scrim (the chart must stay pannable behind it) —
// wrong for a modal filter surface, right for a map peek.
import { ScrollView, View } from "react-native";

import type { ReactNode } from "react";

import { ASSET_CLASSES } from "../../lib/asset-classes";
import type { AssetNoun } from "../../lib/asset-noun";
import { starField, starFieldTitle } from "../../lib/star-field";
import type { AssetClass } from "../../lib/types";
import type { DateRange } from "../../stores/map-state";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { Sheet } from "../ui/sheet";
import { BodyText, DisplayText } from "../ui/text";
import { TextField } from "../ui/text-field";

export const RADII = [5, 10, 25, 50, 100] as const;

/** A titled block. Hairline above, never a box — one nesting level only. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5 border-t border-border-default px-4 py-4">
      <BodyText className="text-overline uppercase text-text-tertiary">{title}</BodyText>
      {children}
    </View>
  );
}

export function FilterSheet({
  assetClass,
  onAssetClass,
  radiusKm,
  onRadiusKm,
  dateRange,
  onOpenDates,
  onClearDates,
  priceMin,
  priceMax,
  onPriceMin,
  onPriceMax,
  specMin,
  specMax,
  onSpecMin,
  onSpecMax,
  resultCount,
  hasMore,
  resultNoun,
  activeCount,
  onClearAll,
  onDismiss,
}: {
  assetClass: AssetClass | null;
  onAssetClass: (next: AssetClass | null) => void;
  radiusKm: number;
  onRadiusKm: (next: number) => void;
  dateRange: DateRange | null;
  onOpenDates: () => void;
  onClearDates: () => void;
  priceMin: string;
  priceMax: string;
  onPriceMin: (v: string) => void;
  onPriceMax: (v: string) => void;
  specMin: string;
  specMax: string;
  onSpecMin: (v: string) => void;
  onSpecMax: (v: string) => void;
  resultCount: number;
  hasMore: boolean;
  /** "asset" or "yard" — follows the screen's grouping, so location mode
   *  doesn't call a list of yard cards a list of assets. */
  /** Pluralisation cannot be an appended "s" — "facility" would become
   *  "facilitys". The caller passes the resolved noun pair (D-029). */
  resultNoun: AssetNoun;
  activeCount: number;
  onClearAll: () => void;
  onDismiss: () => void;
}) {
  const star = starField(assetClass);
  return (
    <Sheet onDismiss={onDismiss} halfRatio={0.85} fullRatio={0.92}>
      <View className="flex-row items-center justify-between px-4 pb-3">
        <DisplayText className="text-h2">Filters</DisplayText>
        {activeCount > 0 ? (
          <Button variant="ghost" label="Clear all" onPress={onClearAll} />
        ) : null}
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Section title="Category">
          <View className="flex-row flex-wrap gap-2">
            {ASSET_CLASSES.map((meta) => (
              <Chip
                key={meta.value}
                label={meta.label}
                selected={assetClass === meta.value}
                onPress={() => onAssetClass(assetClass === meta.value ? null : meta.value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Distance">
          <View className="flex-row flex-wrap gap-2">
            {RADII.map((r) => (
              <Chip
                key={r}
                label={`${r} km`}
                mono
                selected={radiusKm === r}
                onPress={() => onRadiusKm(r)}
              />
            ))}
          </View>
        </Section>

        {/* "Hire window", NOT "Availability": dates do not filter rows out —
            common.matches() never checks availability. They only change each
            row's `available` flag, i.e. what the caption says. */}
        <Section title="Hire window">
          <View className="flex-row items-center gap-2">
            <Chip
              label={dateRange ? `${dateRange.from} → ${dateRange.to}` : "Any dates"}
              mono
              selected={dateRange !== null}
              onPress={onOpenDates}
              a11yLabel="Choose hire dates"
            />
            {dateRange ? (
              <Chip label="✕" a11yLabel="Clear dates" onPress={onClearDates} />
            ) : null}
          </View>
          <BodyText className="text-caption text-text-tertiary">
            Shows what’s free for those dates instead of just today.
          </BodyText>
        </Section>

        <Section title="Price per day">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Min ₦"
                keyboardType="number-pad"
                value={priceMin}
                onChangeText={onPriceMin}
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Max ₦"
                keyboardType="number-pad"
                value={priceMax}
                onChangeText={onPriceMax}
              />
            </View>
          </View>
        </Section>

        {/* ★ spec — class-dependent; the server 400s a bound without a class. */}
        <Section title={star ? starFieldTitle(assetClass) : "Specifications"}>
          {star ? (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label={`Min ${star.unit}`}
                  keyboardType="numeric"
                  value={specMin}
                  onChangeText={onSpecMin}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label={`Max ${star.unit}`}
                  keyboardType="numeric"
                  value={specMax}
                  onChangeText={onSpecMax}
                />
              </View>
            </View>
          ) : (
            <BodyText className="text-body-sm text-text-tertiary">
              Pick a category to filter on its headline spec.
            </BodyText>
          )}
        </Section>

        <View className="h-24" />
      </ScrollView>

      <View
        className="border-t border-border-default bg-surface-card px-4 pb-6 pt-3"
        pointerEvents="box-none"
      >
        <Button
          label="Show results"
          sublabel={`${resultCount}${hasMore ? "+" : ""} ${
            resultCount === 1 ? resultNoun.one : resultNoun.many
          }`}
          onPress={onDismiss}
        />
      </View>
    </Sheet>
  );
}
