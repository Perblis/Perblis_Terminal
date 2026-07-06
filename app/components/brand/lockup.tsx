import { View } from "react-native";

import { DisplayText } from "../ui/text";
import { TCrane } from "./t-crane";

/**
 * Plate lockup (01 §1): wordmark set like a vehicle plate — ink field,
 * amber rule, Archivo caps — with the T-crane glyph.
 */
export function PlateLockup({ size = "lg" }: { size?: "lg" | "sm" }) {
  const glyph = size === "lg" ? 40 : 24;
  return (
    <View className="flex-row items-center gap-3">
      <TCrane size={glyph} />
      <View className="border-l-2 border-surface-brand pl-3">
        <DisplayText
          className={`font-display-bold tracking-widest text-text-inverse ${size === "lg" ? "text-3xl" : "text-lg"}`}
        >
          TERMINAL
        </DisplayText>
      </View>
    </View>
  );
}
