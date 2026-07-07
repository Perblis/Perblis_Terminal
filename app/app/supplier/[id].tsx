import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S13 Storefront — built in 8B-7. */
export default function Storefront() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Company profile</DisplayText>
      <BodyText className="mt-2 text-text-secondary">Coming in 8B-7.</BodyText>
    </View>
  );
}
