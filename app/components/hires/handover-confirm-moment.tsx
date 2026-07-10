// Handover "both ticks settle" — signature moment V7③ (08 §6), restrained per
// D-023: the ticks fade in sequence (no scale pop), a Medium haptic + the
// handover-confirm sound fire, and reduced motion renders the settled state
// instantly. Shown as a brief overlay after the counterparty's confirmation
// lands.
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Modal, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { playHandoverConfirm } from "../../lib/sounds";
import { BodyText, DisplayText } from "../ui/text";

function Tick() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M4 12 l5 5 L20 6" stroke="#059669" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AnimatedTick({ delay }: { delay: number }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withDelay(delay, withTiming(1, { duration: 160 }));
  }, [delay, reducedMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style} className="h-11 w-11 items-center justify-center rounded-full bg-green-50">
      <Tick />
    </Animated.View>
  );
}

export function HandoverConfirmMoment({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!visible) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playHandoverConfirm();
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      {/* Fixed ink scrim — the moment overlay is designed dark in both themes. */}
      <View className="flex-1 items-center justify-center bg-ink-900/90 px-8">
        <View className="items-center gap-4">
          <View className="flex-row gap-3">
            <AnimatedTick delay={0} />
            <AnimatedTick delay={220} />
          </View>
          <DisplayText className="text-h2 text-paper-0">Handover confirmed</DisplayText>
          <BodyText className="text-center text-ink-300">Both parties have signed off.</BodyText>
        </View>
      </View>
    </Modal>
  );
}
