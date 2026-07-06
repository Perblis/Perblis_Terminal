import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S4 Map home — the real Terminal Chart map lands in slice 8B. */
export default function MapTab() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Map</DisplayText>
      <BodyText className="mt-2 text-center text-text-secondary">
        The Terminal Chart arrives in slice 8B — assets for hire, mapped around you.
      </BodyText>
    </View>
  );
}
