import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S7 Request flow — built in 8C-3. */
export default function HireRequest() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Request to hire</DisplayText>
      <BodyText className="mt-2 text-text-secondary">Flow for {listingId} lands in 8C-3.</BodyText>
    </View>
  );
}
