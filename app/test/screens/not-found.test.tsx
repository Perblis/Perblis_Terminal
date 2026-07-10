// S17 · Not found — dead deep links land here; "Back to Map" replaces (the
// dead URL must leave history).
import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import NotFound from "../../app/+not-found";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

describe("NotFound (S17)", () => {
  test("renders the copy and replaces to the Map tab", async () => {
    const screen = await renderScreen(<NotFound />);
    expect(screen.getByText("This page doesn’t exist")).toBeTruthy();
    fireEvent.press(screen.getByText("Back to Map"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
