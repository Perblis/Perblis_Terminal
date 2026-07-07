import { View } from "react-native";

import { BodyText, DisplayText } from "../components/ui/text";

/** S5 Yard Sheet — replaced by the bottom-sheet implementation in 8B-5. */
export default function YardSheet() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Yard</DisplayText>
      <BodyText className="mt-2 text-text-secondary">The yard sheet lands in 8B-5.</BodyText>
    </View>
  );
}
