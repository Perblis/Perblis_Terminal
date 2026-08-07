import { View } from "react-native";

import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";

/**
 * S17 · Offline full (no cache): the device is offline AND the screen has
 * nothing persisted to show. Screens render this in place of their error
 * state when `useOffline()` is true and the query has no data.
 */
export function OfflineNoCache({ onRetry }: { onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <EmptyState
        title={"You’re offline"}
        body="Nothing saved to show yet. Reconnect and this screen will fill in."
      />
      {onRetry ? (
        <View className="mt-2 w-full">
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
