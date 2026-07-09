import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HazardStripe } from "../../components/brand/hazard-stripe";
import { BodyText, DisplayText } from "../../components/ui/text";

/** S17 suspended (blocking). Full S17 system set lands in slice 8F. */
export default function Suspended() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-inverse" style={{ paddingTop: insets.top }}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <DisplayText className="text-h1 text-text-inverse">Account suspended</DisplayText>
        <BodyText className="text-center text-ink-300">
          Your account is suspended and can{'\u2019'}t sign in. If you think this is a mistake, contact
          support@terminal.ng and we{'\u2019'}ll look into it.
        </BodyText>
      </View>
      <HazardStripe height={8} />
      <View style={{ height: insets.bottom }} className="bg-surface-inverse" />
    </View>
  );
}
