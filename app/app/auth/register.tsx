import { View } from "react-native";

import { BodyText, DisplayText } from "../../components/ui/text";

/** S2 register — built in slice 8A-8. */
export default function Register() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page px-6">
      <DisplayText className="text-h2">Create your account</DisplayText>
      <BodyText className="mt-2 text-text-secondary">Coming next.</BodyText>
    </View>
  );
}
