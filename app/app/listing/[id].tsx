import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S6 Listing Detail — built in slice 8C. */
export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Listing</DisplayText>
      <BodyText className="mt-2 text-text-secondary">Detail for {id} lands in slice 8C.</BodyText>
    </View>
  );
}
