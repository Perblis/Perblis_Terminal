/* eslint-disable react-hooks/immutability -- Reanimated shared values are
   mutated by design inside worklet callbacks; the React Compiler lint cannot
   see through useSharedValue. */
// Bespoke bottom sheet (D-019 spirit — no dependency): half→full snaps,
// drag-down dismiss, spring physics (V5), reduced-motion jumps to state.
import { useEffect } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { ReactNode } from "react";

const SPRING = { damping: 20, stiffness: 180 };

export function Sheet({
  onDismiss,
  children,
  halfRatio = 0.55,
  fullRatio = 0.92,
}: {
  onDismiss: () => void;
  children: ReactNode;
  halfRatio?: number;
  fullRatio?: number;
}) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const halfY = height * (1 - halfRatio);
  const fullY = height * (1 - fullRatio);
  const y = useSharedValue(height);
  const startY = useSharedValue(halfY);

  useEffect(() => {
    y.value = reducedMotion ? halfY : withSpring(halfY, SPRING);
    // Present once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    onDismiss();
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = y.value;
    })
    .onUpdate((e) => {
      y.value = Math.max(fullY, startY.value + e.translationY);
    })
    .onEnd((e) => {
      const projected = y.value + e.velocityY * 0.15;
      if (projected > height * 0.75) {
        y.value = withSpring(height, SPRING, () => runOnJS(dismiss)());
      } else if (projected < (halfY + fullY) / 2) {
        y.value = withSpring(fullY, SPRING);
      } else {
        y.value = withSpring(halfY, SPRING);
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      <Pressable
        accessibilityLabel="Dismiss"
        className="absolute inset-0"
        onPress={onDismiss}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          className="absolute inset-x-0 bottom-0 rounded-t-xl border border-border bg-surface-card shadow-lg"
          style={[{ height }, style]}
        >
          <View className="items-center py-2.5">
            <View className="h-1 w-10 rounded-full bg-ink-300" />
          </View>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
