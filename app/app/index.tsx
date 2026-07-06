import { View } from "react-native";

import { BodyText, MonoText } from "../components/ui/text";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page">
      <MonoText>Terminal</MonoText>
      <BodyText className="mt-2 text-text-secondary">Hirer app — Wave 8</BodyText>
    </View>
  );
}
