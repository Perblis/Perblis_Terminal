import { View } from "react-native";

import { useOffline } from "../../lib/use-offline";
import { BodyText } from "../ui/text";

/**
 * Inline ink-900 offline strip for list screens that render cold from the
 * persisted cache (S9 Hires, S14 Messages) — explains why the data may be
 * stale. Copy from 09 §4 Empty/system. Renders nothing while online.
 */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <View className="mx-4 my-2 rounded-md bg-surface-inverse px-4 py-2.5">
      <BodyText className="text-body-sm text-text-inverse">Offline — showing saved data</BodyText>
    </View>
  );
}
