 
// CountdownPill (07 §10) with HARD urgency (V15, restrained per D-023): calm
// mono → amber under 4h → brand-amber frame + haptic threshold ticks under
// 1h. Urgency is carried by colour and the haptic, not by pulsing motion.
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import { useCountdown } from "../../lib/use-countdown";
import { BodyText, MonoText } from "../ui/text";

export function CountdownPill({ deadlineIso }: { deadlineIso: string }) {
  const parts = useCountdown(deadlineIso);
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
    // Haptic tick on band crossings (V15) — not on first render.
    if (lastBand.current !== null && lastBand.current !== band && band !== "calm") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    lastBand.current = band;
  }, [band]);

  if (!parts) return null;

  const frame =
    band === "expired"
      ? "bg-surface-sunken"
      : band === "critical"
        ? "bg-surface-brand"
        : band === "amber"
          ? "bg-amber-100"
          : "bg-surface-sunken";
  // amber band: fixed amber-100 chip needs fixed amber-900 text — the
  // theme-flipping primary/tertiary colours go near-white on it in dark.
  const text =
    band === "critical"
      ? "text-text-on-brand"
      : band === "expired"
        ? "text-text-tertiary"
        : band === "amber"
          ? "text-amber-900"
          : "text-text-primary";
  const caption =
    band === "critical" ? "text-text-on-brand" : band === "amber" ? "text-amber-900" : "text-text-tertiary";

  return (
    <View className={`items-center gap-0.5 self-center rounded-full px-6 py-3 ${frame}`}>
      <MonoText className={`text-money-hero ${text}`}>{parts.expired ? "0:00" : parts.label}</MonoText>
      <BodyText className={`text-caption ${caption}`}>
        {parts.expired ? "payment window closed" : "left to pay"}
      </BodyText>
    </View>
  );
}
