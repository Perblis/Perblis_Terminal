import { Pressable, ScrollView, View } from "react-native";

import { ASSET_CLASSES } from "../../lib/asset-classes";
import type { AssetClass } from "../../lib/types";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import { BodyText, MonoText } from "../ui/text";

/** S4 class FilterBar: one-active-class chips + trailing result-count chip. */
export function FilterBar({
  active,
  onChange,
  resultCount,
}: {
  active: AssetClass | null;
  onChange: (next: AssetClass | null) => void;
  resultCount: number | null;
}) {
  return (
    <View className="flex-row items-center">
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
                <Glyph size={15} color={selected ? "#F59E0B" : "#3A3F4A"} />
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
        <View className="mr-4 rounded-full bg-surface-inverse px-3 py-1.5">
          <MonoText className="text-body-sm text-text-inverse">{resultCount} assets</MonoText>
        </View>
      ) : null}
    </View>
  );
}
