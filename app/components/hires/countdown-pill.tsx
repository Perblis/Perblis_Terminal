 
// CountdownPill (07 §10) with HARD urgency (V15): calm mono → amber under
// 4h → pulsing + haptic threshold ticks under 1h. Reduced-motion: no pulse.
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useCountdown } from "../../lib/use-countdown";
import { BodyText, MonoText } from "../ui/text";

export function CountdownPill({ deadlineIso }: { deadlineIso: string }) {
  const parts = useCountdown(deadlineIso);
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const lastBand = useRef<"calm" | "amber" | "critical" | "expired" | null>(null);

  const band = !parts
    ? "calm"
    : parts.expired
      ? "expired"
      : parts.totalSeconds < 3600
        ? "critical"
        : parts.totalSeconds < 4 * 3600
          ? "amber"
          : "calm";

  useEffect(() => {
    if (band === "critical" && !reducedMotion) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.04, { duration: 550 }), withTiming(1, { duration: 550 })),
        -1,
      );
    } else {
      pulse.value = 1;
    }
    // Haptic tick on band crossings (V15) — not on first render.
    if (lastBand.current !== null && lastBand.current !== band && band !== "calm") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    lastBand.current = band;
  }, [band, reducedMotion, pulse]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!parts) return null;

  const frame =
    band === "expired"
      ? "bg-surface-sunken"
      : band === "critical"
        ? "bg-surface-brand"
        : band === "amber"
          ? "bg-amber-100"
          : "bg-surface-sunken";
  const text =
    band === "critical" ? "text-text-on-brand" : band === "expired" ? "text-text-tertiary" : "text-text-primary";

  return (
    <Animated.View style={style} className={`items-center gap-0.5 self-center rounded-full px-6 py-3 ${frame}`}>
      <MonoText className={`text-money-hero ${text}`}>{parts.expired ? "0:00" : parts.label}</MonoText>
      <BodyText className={`text-caption ${band === "critical" ? "text-text-on-brand" : "text-text-tertiary"}`}>
        {parts.expired ? "payment window closed" : "left to pay"}
      </BodyText>
    </Animated.View>
  );
}
