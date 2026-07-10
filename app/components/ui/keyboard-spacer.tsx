import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "../../lib/keyboard";

/**
 * Android keyboard relief: grows to keep bottom-pinned content (composers,
 * submit buttons) above the IME, which draws OVER the app under edge-to-edge.
 * The host's safe-area bottom padding is subtracted (the keyboard height
 * already spans that region). iOS renders nothing — screens there keep the
 * working KeyboardAvoidingView behavior="padding".
 */
export function KeyboardSpacer({ offset = 0 }: { offset?: number }) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  if (Platform.OS === "ios") return null;
  return <View style={{ height: Math.max(0, keyboardHeight - insets.bottom - offset) }} />;
}
