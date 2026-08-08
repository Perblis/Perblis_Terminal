// The 3-stop sheet's snap arithmetic (2026-08-08). Gesture code can't be
// unit-tested, so the decision is a pure function — same reasoning as
// makeSnapPlanner in pin-carousel.
//
// The behaviour that matters for the map: dragging DOWN from `full` collapses
// one stop at a time rather than closing, so a user reading a bay's inventory
// can't lose the sheet with one careless flick; only a drag-down from the
// LOWEST stop dismisses.
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  MAP_SNAPS,
  DEFAULT_SNAPS,
  Sheet,
  resolveSnap,
  snapOffsets,
} from "../../components/ui/sheet";

const H = 800; // screen height

describe("MAP_SNAPS (peek 88pt · half 50% · full 92%)", () => {
  const peekY = H - 88; // 712
  const halfY = H * 0.5; // 400
  const fullY = H * 0.08; // 64

  test("offsets are ordered lowest-on-screen first", () => {
    const stops = snapOffsets(MAP_SNAPS, H);
    expect(stops.map((s) => s.name)).toEqual(["peek", "half", "full"]);
    expect(stops[0].y).toBeCloseTo(peekY);
    expect(stops[1].y).toBeCloseTo(halfY);
    expect(stops[2].y).toBeCloseTo(fullY); // 1 - 0.92 is not exactly 0.08
  });

  test("settling near a stop snaps to it", () => {
    expect(resolveSnap(fullY + 10, MAP_SNAPS, H)).toBe("full");
    expect(resolveSnap(halfY - 20, MAP_SNAPS, H)).toBe("half");
    expect(resolveSnap(halfY + 20, MAP_SNAPS, H)).toBe("half");
    expect(resolveSnap(peekY - 10, MAP_SNAPS, H)).toBe("peek");
  });

  test("a drag down from full collapses to half, never straight to dismissed", () => {
    // Midway between full and half, biased downward.
    expect(resolveSnap(fullY + (halfY - fullY) * 0.6, MAP_SNAPS, H)).toBe("half");
  });

  test("a drag down from half collapses to peek", () => {
    expect(resolveSnap(halfY + (peekY - halfY) * 0.6, MAP_SNAPS, H)).toBe("peek");
  });

  test("only a drag down from the lowest stop dismisses", () => {
    // Halfway between peek and the bottom of the screen is the threshold.
    const threshold = peekY + (H - peekY) / 2; // 756
    expect(resolveSnap(threshold - 1, MAP_SNAPS, H)).toBe("peek");
    expect(resolveSnap(threshold + 1, MAP_SNAPS, H)).toBe("dismiss");
    expect(resolveSnap(H, MAP_SNAPS, H)).toBe("dismiss");
  });

  test("a fast upward flick from peek reaches full", () => {
    // Projection already past `full` (velocity carried it above the clamp).
    expect(resolveSnap(fullY - 200, MAP_SNAPS, H)).toBe("full");
  });
});

describe("DEFAULT_SNAPS (legacy half/full, no peek)", () => {
  test("still resolves without a peek stop", () => {
    const halfY = H * (1 - DEFAULT_SNAPS.half);
    expect(snapOffsets(DEFAULT_SNAPS, H).map((s) => s.name)).toEqual(["half", "full"]);
    expect(resolveSnap(halfY, DEFAULT_SNAPS, H)).toBe("half");
    // Dismiss threshold is measured from `half`, the lowest stop here.
    expect(resolveSnap(halfY + (H - halfY) / 2 + 1, DEFAULT_SNAPS, H)).toBe("dismiss");
  });
});

describe("tap-to-expand ladder", () => {
  test("tapping the grab area climbs one stop and never dismisses", async () => {
    const onSnapChange = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <Sheet
        snapPoints={MAP_SNAPS}
        initialSnap="peek"
        onSnapChange={onSnapChange}
        onDismiss={onDismiss}
        header={<Text>Ojota Plant Bay</Text>}
      >
        <Text>inventory</Text>
      </Sheet>,
    );

    expect(onSnapChange).toHaveBeenLastCalledWith("peek");

    const grab = screen.getByLabelText("Expand or collapse");
    await fireEvent.press(grab); // peek → half
    expect(onSnapChange).toHaveBeenLastCalledWith("half");

    await fireEvent.press(grab); // half → full
    expect(onSnapChange).toHaveBeenLastCalledWith("full");

    await fireEvent.press(grab); // stays at full — a tap must never close
    expect(onSnapChange).toHaveBeenLastCalledWith("full");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test("a non-collapsible (legacy) sheet exposes no expand affordance", async () => {
    const screen = await render(
      <Sheet onDismiss={jest.fn()}>
        <Text>body</Text>
      </Sheet>,
    );
    expect(screen.queryByLabelText("Expand or collapse")).toBeNull();
    // …and keeps its tap-to-dismiss scrim.
    expect(screen.getByLabelText("Dismiss")).toBeTruthy();
  });
});

describe("worklet safety (2026-08-08 crash regression)", () => {
  // The shipped build crashed on every gesture RELEASE: `.onEnd` runs on the
  // UI thread, and it called `resolveSnap` — a plain JS function at the time.
  // Calling a non-worklet from a worklet throws and takes the app down.
  //
  // Nothing else caught this. The Reanimated jest mock runs worklets as
  // ordinary JS, so every behavioural test above passed while the device died.
  // The Babel plugin stamps real worklets with __workletHash, so asserting on
  // that is the one check that actually reaches the failure mode.
  test.each([
    ["resolveSnap", resolveSnap],
    ["snapOffsets", snapOffsets],
  ])("%s is compiled as a worklet — it is called from Gesture.onEnd", (_name, fn) => {
    expect(typeof (fn as unknown as { __workletHash?: number }).__workletHash).toBe("number");
  });
});
