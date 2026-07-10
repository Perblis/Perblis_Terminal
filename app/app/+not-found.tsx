import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";

/**
 * S17 · Not found — unmatched routes and dead deep links. Runs inside the
 * root layout (providers exist). `replace` so the dead URL leaves history.
 */
export default function NotFound() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 items-center justify-center bg-surface-page px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <EmptyState
        title={"This page doesn’t exist"}
        body="The link may be old, or the thing it pointed at is gone."
      />
      <View className="mt-2 w-full">
        <Button label="Back to Map" onPress={() => router.replace("/(tabs)")} />
      </View>
    </View>
  );
}
