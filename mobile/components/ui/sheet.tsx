/* eslint-disable react-hooks/immutability -- Reanimated shared values are
   mutated by design inside worklet callbacks; the React Compiler lint cannot
   see through useSharedValue. */
// Bespoke bottom sheet (D-019 spirit — no dependency): spring physics (V5),
// drag-down dismiss, reduced-motion jumps to state.
//
// 3-stop revision (founder, 2026-08-08): the map needed a sheet that COLLAPSES
// rather than one that is either up or gone. Snap points now follow
// design-system ch.04 §3 — peek 88pt · half 50% · full 92% — and the scrim
// only arrives at `full`. At peek and half the backdrop is inert, so the map
// stays visible AND pannable behind the sheet, which is the whole point of a
// map-first marketplace: you never lose "where" while you read "what".
//
// The snap decision is a pure function (`resolveSnap`) for the same reason
// makeSnapPlanner is: gesture code cannot be unit-tested, arithmetic can.
import { useCallback, useEffect } from "react";
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

export type SnapName = "peek" | "half" | "full";

/** Sheet heights. `peek` is in points (a fixed header band); the other two are
 *  fractions of screen height. Omit `peek` for a plain half/full sheet. */
export type SnapPoints = { peek?: number; half: number; full: number };

export const DEFAULT_SNAPS: SnapPoints = { half: 0.55, full: 0.92 };

/** design-system ch.04 §3 — the map/discovery sheet. */
export const MAP_SNAPS: SnapPoints = { peek: 88, half: 0.5, full: 0.92 };

// ⚠️ BOTH helpers below are WORKLETS and must stay that way.
//
// They are called from Gesture.Pan().onEnd, which Reanimated compiles to run
// on the UI thread. Calling a plain JS function from there throws and takes
// the app down — which is exactly what shipped on 2026-08-08: dragging the
// sheet worked (onUpdate is inline arithmetic) and RELEASING it crashed.
//
// Jest cannot catch this. The Reanimated mock runs worklets as ordinary JS,
// so the unit tests below pass on the JS thread while the device crashes.
// If you add a helper and call it from a gesture callback, it needs the
// directive too.

/** Translate-Y for each stop, largest (lowest on screen) first. */
export function snapOffsets(snaps: SnapPoints, height: number): { name: SnapName; y: number }[] {
  "worklet";
  const stops: { name: SnapName; y: number }[] = [];
  if (snaps.peek !== undefined) stops.push({ name: "peek", y: height - snaps.peek });
  stops.push({ name: "half", y: height * (1 - snaps.half) });
  stops.push({ name: "full", y: height * (1 - snaps.full) });
  return stops;
}

/**
 * Pure: where does a flick ending at `projectedY` land?
 *
 * Returns `"dismiss"` when the projection falls far enough below the LOWEST
 * stop — a drag-down from the bottom stop is the only way out, so a user who
 * drags a peek sheet down closes it, while a user who drags a full sheet down
 * merely collapses it one stop at a time. Otherwise it snaps to the nearest
 * stop by absolute distance.
 */
export function resolveSnap(
  projectedY: number,
  snaps: SnapPoints,
  height: number,
): SnapName | "dismiss" {
  "worklet";
  const stops = snapOffsets(snaps, height);
  const lowest = stops[0]; // largest y — closest to the bottom of the screen
  // Half the remaining gap below the lowest stop reads as intent to close.
  if (projectedY > lowest.y + (height - lowest.y) / 2) return "dismiss";
  let best = stops[0];
  for (const stop of stops) {
    if (Math.abs(projectedY - stop.y) < Math.abs(projectedY - best.y)) best = stop;
  }
  return best.name;
}

export function Sheet({
  onDismiss,
  children,
  halfRatio,
  fullRatio,
  snapPoints,
  initialSnap = "half",
  onSnapChange,
  /** Rendered above `children` and never scrolled — the drag handle sits on it.
   *  At `peek` this is all the user sees, so it must stand alone. */
  header,
}: {
  onDismiss: () => void;
  children: ReactNode;
  /** @deprecated use `snapPoints` */
  halfRatio?: number;
  /** @deprecated use `snapPoints` */
  fullRatio?: number;
  snapPoints?: SnapPoints;
  initialSnap?: SnapName;
  onSnapChange?: (snap: SnapName) => void;
  header?: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const snaps: SnapPoints = snapPoints ?? {
    half: halfRatio ?? DEFAULT_SNAPS.half,
    full: fullRatio ?? DEFAULT_SNAPS.full,
  };
  const stops = snapOffsets(snaps, height);
  const yFor = (name: SnapName) => stops.find((s) => s.name === name)?.y ?? stops[0].y;
  // Resolved to plain numbers here so the gesture worklet can capture them
  // directly and never has to call back into JS-thread code.
  const fullY = yFor("full");
  const halfY = yFor("half");
  const peekY = stops[0].y; // lowest stop: `peek` when present, else `half`
  /** A peek stop means this is a map sheet: the chart must stay reachable. */
  const collapsible = snaps.peek !== undefined;

  const y = useSharedValue(height);
  const startY = useSharedValue(yFor(initialSnap));

  const settle = useCallback(
    (name: SnapName) => {
      onSnapChange?.(name);
    },
    [onSnapChange],
  );

  useEffect(() => {
    const target = yFor(initialSnap);
    y.value = reducedMotion ? target : withSpring(target, SPRING);
    settle(initialSnap);
    // Present once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    onDismiss();
  };

  const goTo = useCallback(
    (name: SnapName) => {
      const target = yFor(name);
      y.value = reducedMotion ? target : withSpring(target, SPRING);
      settle(name);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reducedMotion, settle, height, snaps.peek, snaps.half, snaps.full],
  );

  /** Tap climbs one stop: peek → half → full, and stops there (a tap must
   *  never dismiss — that is the drag-down gesture's job alone). The current
   *  stop is read from where the sheet ACTUALLY is at press time rather than
   *  a mirrored ref, so a tap mid-spring still does the right thing. */
  const expandOneStop = useCallback(() => {
    const restingAtPeek = snaps.peek !== undefined && y.value > (stops[0].y + halfY) / 2;
    goTo(restingAtPeek ? "half" : "full");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo, halfY, snaps.peek]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = y.value;
    })
    .onUpdate((e) => {
      // Clamp at `full`; below the lowest stop we allow the drag so the
      // dismiss gesture has somewhere to go.
      y.value = Math.max(fullY, startY.value + e.translationY);
    })
    .onEnd((e) => {
      const projected = y.value + e.velocityY * 0.15;
      const target = resolveSnap(projected, snaps, height);
      if (target === "dismiss") {
        y.value = withSpring(height, SPRING, () => runOnJS(dismiss)());
        return;
      }
      // Plain captured numbers, NOT yFor() — a component-body closure is not
      // a worklet and calling it here would crash on the UI thread.
      y.value = withSpring(
        target === "full" ? fullY : target === "half" ? halfY : peekY,
        SPRING,
      );
      runOnJS(settle)(target);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  // Scrim fades in ONLY across the half→full leg, and never intercepts touches
  // on a collapsible sheet — at peek and half the map behind stays pannable,
  // which is what "the map must remain visible behind it" actually requires.
  const scrimStyle = useAnimatedStyle(() => {
    const span = halfY - fullY;
    const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (halfY - y.value) / span));
    return { opacity: t * 0.4 };
  });

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      {collapsible ? (
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 bg-black"
          style={scrimStyle}
        />
      ) : (
        <Pressable accessibilityLabel="Dismiss" className="absolute inset-0" onPress={onDismiss} />
      )}
      <Animated.View
        className="absolute inset-x-0 bottom-0 rounded-t-xl border border-border-default bg-surface-card shadow-lg"
        style={[{ height }, sheetStyle]}
      >
        {/* The drag lives on the grab area ONLY. Spanning the whole sheet made
            the pan compete with the inventory ScrollView, and on Android the
            pan usually wins — the list would drag the sheet instead of
            scrolling. Header-only drag is also what makes tap-to-expand
            unambiguous. */}
        <GestureDetector gesture={pan}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsible ? "Expand or collapse" : "Sheet handle"}
            onPress={collapsible ? expandOneStop : undefined}
          >
            <View className="items-center py-2.5">
              <View className="h-1 w-10 rounded-full bg-ink-700" />
            </View>
            {header}
          </Pressable>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

