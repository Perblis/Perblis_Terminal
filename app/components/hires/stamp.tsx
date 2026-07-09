// The Stamp (08 §4, signature moment V7①): drops in at scale 1.15 → 1.0
// with rotate −2° → −6°, 400ms deliberate + a 1px settle; impactMedium
// haptic. Reduced-motion renders the final state instantly.
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { playPaymentSuccess } from "../../lib/sounds";
import { DisplayText } from "../ui/text";

const STAMP_COLORS: Record<string, string> = {
  PAID: "#F59E0B", // amber (06 §8)
  REFUNDED: "#16181D",
  COMPLETED: "#059669",
};

export function Stamp({ label = "PAID", size = 116 }: { label?: string; size?: number }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 1.15);
  const rotate = useSharedValue(reducedMotion ? -6 : -2);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playPaymentSuccess();
    if (reducedMotion) return;
     
    opacity.value = withTiming(1, { duration: 120 });
    scale.value = withSequence(
      withTiming(1.0, { duration: 400, easing: Easing.out(Easing.cubic) }),
      withTiming(1.01, { duration: 60 }), // the 1px settle
      withTiming(1.0, { duration: 60 }),
    );
    rotate.value = withTiming(-6, { duration: 400, easing: Easing.out(Easing.cubic) });
     
  }, [reducedMotion, opacity, scale, rotate]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

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
