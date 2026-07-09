import { View } from "react-native";

import { BodyText, Money } from "../ui/text";

/**
 * The "You pay" hero (D-014). Renders EXCLUSIVELY a server-sourced
 * `hire_value_display` string, verbatim — the prop name is the contract;
 * never pass a client-computed estimate here (the wave-mandated
 * price-preview test enforces it).
 */
export function PriceHero({ serverDisplay, label = "You pay" }: { serverDisplay: string; label?: string }) {
  return (
    <View className="items-center gap-1">
      <BodyText className="text-body-sm text-text-secondary">{label}</BodyText>
      <Money display={serverDisplay} hero />
      <BodyText className="text-caption text-text-tertiary">One total. No surprises.</BodyText>
    </View>
  );
}
