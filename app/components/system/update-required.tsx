import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HazardStripe } from "../brand/hazard-stripe";
import { TCrane } from "../brand/t-crane";
import { Button } from "../ui/button";
import { BodyText, DisplayText } from "../ui/text";

/**
 * S17 · Update required — presentational blocking screen (the UpdateGate
 * owns the expo-updates wiring). `ready` flips once the critical update has
 * finished downloading; restarting before that would relaunch the old
 * bundle, so the button stays busy until then.
 */
export function UpdateRequired({ ready, onRestart }: { ready: boolean; onRestart: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-inverse" style={{ paddingTop: insets.top }}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <TCrane size={56} />
        <DisplayText className="text-h1 text-center text-text-inverse">Update required</DisplayText>
        <BodyText className="text-center text-ink-300">
          This version of Terminal is out of date and needs an update before it can continue.
          {ready ? " The update is ready — restart to apply it." : " Downloading the update…"}
        </BodyText>
        <View className="mt-3 w-full">
          <Button label="Restart to update" busy={!ready} onPress={onRestart} />
        </View>
      </View>
      <HazardStripe height={8} />
      <View style={{ height: insets.bottom }} className="bg-surface-inverse" />
    </View>
  );
}
