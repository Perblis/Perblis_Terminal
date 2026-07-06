import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S-placeholder — built in a later Wave 8 slice. */
export default function ProfileTab() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Profile</DisplayText>
      <BodyText className="mt-2 text-center text-text-secondary">Coming in this wave.</BodyText>
    </View>
  );
}
