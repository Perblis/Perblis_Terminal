import Onboarding from "../app/onboarding";
import { renderScreen } from "./render";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

test("smoke: onboarding renders the S1 value prop", async () => {
  const { getByText } = await renderScreen(<Onboarding />);
  expect(getByText("Find heavy assets near your site")).toBeTruthy();
  expect(getByText("TERMINAL")).toBeTruthy();
});
