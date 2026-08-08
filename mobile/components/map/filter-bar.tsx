import { Pressable, ScrollView, View } from "react-native";

import { ASSET_CLASSES } from "../../lib/asset-classes";
import { useThemeTokens } from "../../lib/theme";
import type { AssetClass } from "../../lib/types";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import { BodyText, MonoText } from "../ui/text";

/**
 * S4 class FilterBar. The result count lives on its own row BELOW the chips —
 * a trailing overlay chopped scrolling chip labels mid-word and its inverse
 * fill made a passive readout the brightest element on screen (and it read
 * as tappable). Down here it's a drab mono telemetry line, ClusterPin
 * philosophy (06 §3): ambient information, not a control.
 *
 * 2026-08-08 (founder): the bar was eating ~62pt of a map that is the whole
 * point of the screen. Chips are now 34pt tall with hitSlop restoring the
 * ≥48dp touch target (FSD §12 is about the TARGET, not the paint), the count
 * lost its box, and the row ends in a fade so a half-scrolled chip reads as
 * "there is more" rather than as a rendering bug.
 */
export function FilterBar({
  active,
  onChange,
  resultCount,
  countText,
}: {
  active: AssetClass | null;
  onChange: (next: AssetClass | null) => void;
  resultCount: number | null;
  /** Overrides the default "N assets in view" line. S12 uses it to disclose
   *  ordering ("24+ assets · nearest first") — the /search/list contract has
   *  no total and no sort param, so both facts have to be stated honestly. */
  countText?: string;
}) {
  const t = useThemeTokens();
  return (
    <View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Trailing room so the last chip can clear the fade completely.
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 40 }}
        >
          <View className="flex-row gap-2">
            {ASSET_CLASSES.map((meta) => {
              const selected = active === meta.value;
              const Glyph = CLASS_GLYPHS[meta.value];
              return (
                <Pressable
                  key={meta.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onChange(selected ? null : meta.value)}
                  // 34pt painted + 7pt top/bottom slop = 48dp target.
                  hitSlop={{ top: 7, bottom: 7 }}
                  className={`h-[34px] flex-row items-center gap-1.5 rounded-full px-3.5 ${
                    selected ? "bg-surface-brand" : "border border-border-strong bg-surface-card"
                  }`}
                >
                  <Glyph
                    size={14}
                    color={selected ? t["--text-on-brand"] : t["--text-secondary"]}
                  />
                  <BodyText
                    className={`text-body-sm ${
                      selected ? "font-sans-semibold text-text-on-brand" : "text-text-secondary"
                    }`}
                  >
                    {meta.label}
                  </BodyText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {/* Scroll affordance: the row visibly runs off the edge on purpose.
            A plain View stack rather than a gradient — expo-linear-gradient is
            not a dependency and this reads the same at these widths. */}
        <View
          pointerEvents="none"
          className="absolute bottom-0 right-0 top-0 flex-row items-center"
        >
          <View className="h-full w-4 opacity-40" style={{ backgroundColor: t["--surface-page"] }} />
          <View className="h-full w-4 opacity-80" style={{ backgroundColor: t["--surface-page"] }} />
        </View>
      </View>
      {countText !== undefined || resultCount !== null ? (
        <View className="ml-4 mt-2 self-start">
          <MonoText className="text-caption text-text-tertiary">
            {countText ??
              `${resultCount} ${resultCount === 1 ? "asset" : "assets"} in view`}
          </MonoText>
        </View>
      ) : null}
    </View>
  );
}
