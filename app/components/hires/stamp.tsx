// The Stamp (08 §4, signature moment V7①), restrained per D-023: the plate
// fades in at its final −6° set, impactMedium haptic + sound fire once — no
// scale drop, no settle theatrics. Reduced-motion renders instantly.
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { playPaymentSuccess } from "../../lib/sounds";
import { useThemeTokens } from "../../lib/theme";
import { DisplayText } from "../ui/text";

export function Stamp({ label = "PAID", size = 116 }: { label?: string; size?: number }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playPaymentSuccess();
    if (reducedMotion) return;
    opacity.value = withTiming(1, { duration: 160 });
  }, [reducedMotion, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: "-6deg" }],
  }));

  const tk = useThemeTokens();
  // amber (06 §8) for PAID; the others follow the theme so REFUNDED's ink
  // doesn't vanish on the dark page.
  const STAMP_COLORS: Record<string, string> = {
    PAID: tk["--surface-brand"],
    REFUNDED: tk["--text-primary"],
    COMPLETED: tk["--status-onHire"],
  };
  const color = STAMP_COLORS[label] ?? STAMP_COLORS.PAID;

  return (
    <Animated.View style={style}>
      <View
        className="items-center justify-center rounded-md"
        style={{ width: size, height: size * 0.45, borderWidth: 3.5, borderColor: color }}
      >
        <DisplayText className="font-display-bold tracking-widest" style={{ color, fontSize: size * 0.22 }}>
          {label}
        </DisplayText>
      </View>
    </Animated.View>
  );
}
