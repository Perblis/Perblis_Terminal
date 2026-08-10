import { Image } from "expo-image";
import { View } from "react-native";

/**
 * Onboarding backdrop (wave-8-vision V3): real aerial photography of a night
 * container terminal — one lime container carries the accent. The ink scrim
 * keeps the onboarding copy legible; the screen stays dark in both themes.
 * The component remains the seam if 8B later swaps in the blurred live map.
 * Bundled asset, so it ships with OTA updates — no network fetch.
 */
export function ChartTease() {
  return (
    <View className="absolute inset-0 bg-ink-900" accessible={false}>
      <Image
        source={require("../../assets/onboarding-port.webp")}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        contentFit="cover"
      />
      <View className="absolute inset-0 bg-ink-900/55" />
    </View>
  );
}
