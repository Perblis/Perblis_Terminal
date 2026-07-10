// Android keyboard relief: under SDK 57 edge-to-edge the IME draws OVER the
// app (adjustResize no longer works), so bottom-pinned composers/buttons pad
// themselves by the live keyboard height (minus the safe-area bottom the
// host already pads by).
import { act } from "@testing-library/react-native";
import { Keyboard, Platform } from "react-native";

import { KeyboardSpacer } from "../../components/ui/keyboard-spacer";
import { renderScreen } from "../render";

type KeyboardHandler = (e: { endCoordinates: { height: number } }) => void;
const handlers: Record<string, KeyboardHandler> = {};

beforeEach(() => {
  Platform.OS = "android";
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: KeyboardHandler) => {
    handlers[event] = cb;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  Platform.OS = "ios";
  jest.restoreAllMocks();
});

function spacerHeight(tree: ReturnType<typeof JSON.parse>): number | undefined {
  const json = JSON.stringify(tree);
  const m = /"height":(\d+)/.exec(json);
  return m ? Number(m[1]) : undefined;
}

test("pads by keyboard height minus the bottom inset when the keyboard shows", async () => {
  const screen = await renderScreen(<KeyboardSpacer />);
  await act(async () => handlers.keyboardDidShow({ endCoordinates: { height: 300 } }));
  // renderScreen's initialMetrics set insets.bottom = 34 → 300 − 34 = 266.
  expect(spacerHeight(screen.toJSON())).toBe(266);
});

test("collapses to zero on keyboardDidHide", async () => {
  const screen = await renderScreen(<KeyboardSpacer />);
  await act(async () => handlers.keyboardDidShow({ endCoordinates: { height: 300 } }));
  await act(async () => handlers.keyboardDidHide({ endCoordinates: { height: 0 } }));
  expect(spacerHeight(screen.toJSON())).toBe(0);
});
