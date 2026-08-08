// Chip (2026-08-09). Selectable filter chips were hand-rolled in four places
// with four slightly different borders, paddings and selected treatments —
// which is a large part of why S12 read as a wall of equal-weight pills.
//
// One shape, two states: unselected is a sunken well with no border, selected
// is raised onto surface-card with a medium label. Borderless by default —
// contrast and weight carry the state (07 §11 de-boxing).
import { Pressable, View } from "react-native";

import { BodyText, MonoText } from "./text";

export function Chip({
  label,
  selected = false,
  mono = false,
  onPress,
  a11yLabel,
  /** Trailing ✕ affordance for an applied-filter chip. */
  dismissible = false,
  testID,
}: {
  label: string;
  selected?: boolean;
  /** Figures (distances, dates, money) read in mono — never sentences. */
  mono?: boolean;
  onPress: () => void;
  a11yLabel?: string;
  dismissible?: boolean;
  testID?: string;
}) {
  const Label = mono ? MonoText : BodyText;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      // 32pt painted + 8pt slop keeps the 48dp target (FSD §12) without a
      // 48pt-tall chip row.
      hitSlop={{ top: 8, bottom: 8 }}
      className={`h-8 flex-row items-center gap-1.5 rounded-full px-3.5 ${
        selected ? "bg-surface-card" : "bg-surface-sunken"
      }`}
    >
      {/* A mono chip must NOT also get font-sans-medium: two fontFamily
          utilities on one Text resolve by stylesheet order, not className
          order, so the weight class would silently beat font-mono. */}
      <Label
        className={`text-body-sm ${selected && !mono ? "font-sans-medium " : ""}${
          selected ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {label}
      </Label>
      {dismissible ? (
        <View accessibilityElementsHidden>
          <BodyText className="text-caption text-text-tertiary">✕</BodyText>
        </View>
      ) : null}
    </Pressable>
  );
}
