import { router } from "expo-router";
import { View } from "react-native";

import { Button } from "../../components/ui/button";
import { BodyText, DisplayText } from "../../components/ui/text";
import { logout } from "../../lib/auth-api";
import { useSession } from "../../stores/session";

/** S16 Profile — full identity/verification/settings surface lands in 8E. */
export default function ProfileTab() {
  const me = useSession((s) => s.me);
  const setMe = useSession((s) => s.setMe);

  const signOut = async () => {
    await logout();
    setMe(null);
    router.replace("/(tabs)");
  };

  return (
    <View className="flex-1 justify-center gap-4 bg-surface-page px-6">
      <DisplayText className="text-h2">{me ? me.full_name : "Profile"}</DisplayText>
      {me ? (
        <>
          <BodyText className="text-text-secondary">{me.email}</BodyText>
          <Button variant="secondary" label="Sign out" onPress={() => void signOut()} />
        </>
      ) : (
        <>
          <BodyText className="text-text-secondary">
            You{"’"}re browsing as a guest. Sign in to request hires and message suppliers.
          </BodyText>
          <Button label="Sign in" onPress={() => router.push("/auth/login")} />
        </>
      )}
    </View>
  );
}
