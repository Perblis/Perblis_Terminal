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
 * as tappable). Down here it's a drab mono telemetry plate, ClusterPin
 * philosophy (06 §3): ambient information, not a control.
 */
export function FilterBar({
  active,
  onChange,
  resultCount,
}: {
  active: AssetClass | null;
  onChange: (next: AssetClass | null) => void;
  resultCount: number | null;
}) {
  const t = useThemeTokens();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2 px-4">
          {ASSET_CLASSES.map((meta) => {
            const selected = active === meta.value;
            const Glyph = CLASS_GLYPHS[meta.value];
            return (
              <Pressable
                key={meta.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange(selected ? null : meta.value)}
                className={`min-h-12 flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
                  selected
                    ? "border-surface-inverse bg-surface-inverse"
                    : "border-border-strong bg-surface-card"
                }`}
              >
                <Glyph size={15} color={selected ? t["--text-brand-on-inverse"] : t["--text-secondary"]} />
                <BodyText
                  className={`text-body-sm ${selected ? "font-sans-semibold text-text-inverse" : "text-text-primary"}`}
                >
                  {meta.label}
                </BodyText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {resultCount !== null ? (
        <View className="mr-4 mt-2 self-end rounded border border-border bg-surface-card px-2.5 py-1">
          <MonoText className="text-caption text-text-secondary">{resultCount} assets</MonoText>
        </View>
      ) : null}
    </View>
  );
}
