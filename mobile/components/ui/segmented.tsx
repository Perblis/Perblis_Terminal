// Segmented control (2026-08-09, founder: "too many pill controls have equal
// visual weight"). S12 had four independent bordered pills — By asset, By
// location, and a "Map view →" link — so four things competed at the same
// weight when they are really TWO controls with two states each.
//
// A segment group is one sunken track with the active segment raised onto
// surface-card. The track reads as a single object; only the raised segment
// carries emphasis. No borders — the contrast between track and segment does
// the work (07 §11 de-boxing).
import { Pressable, View } from "react-native";

import { BodyText } from "./text";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Falls back to `label` — set it when the label alone is ambiguous aloud. */
  a11yLabel?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
}) {
  return (
    <View testID={testID} className="flex-row rounded-full bg-surface-sunken p-0.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            testID={testID ? `${testID}-${opt.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.a11yLabel ?? opt.label}
            onPress={() => onChange(opt.value)}
            // 30pt painted + 9pt slop = the 48dp target the experience bar
            // requires, without a 48pt-tall control eating the viewport.
            hitSlop={{ top: 9, bottom: 9 }}
            className={`h-[30px] items-center justify-center rounded-full px-3.5 ${
              selected ? "bg-surface-card" : ""
            }`}
          >
            <BodyText
              className={`text-body-sm ${
                selected ? "font-sans-medium text-text-primary" : "text-text-tertiary"
              }`}
            >
              {opt.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}
