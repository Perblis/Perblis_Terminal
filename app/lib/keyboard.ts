import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Live software-keyboard height in logical px (0 when hidden). Under SDK 57
 * edge-to-edge Android the window no longer resizes for the IME and
 * KeyboardAvoidingView's Android behaviors are unreliable, so screens pad
 * themselves with this instead.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
