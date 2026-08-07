// S17 · Error 500 — Sentry ref renders only when captureException yields an
// event id (keyless-degraded shows no broken "Ref:" line), and retry fires.
import { fireEvent } from "@testing-library/react-native";

import { ErrorScreen } from "../../components/system/error-screen";
import { captureException } from "../../lib/sentry";
import { renderScreen } from "../render";

jest.mock("../../lib/sentry", () => ({
  captureException: jest.fn(),
}));

const mockCapture = captureException as jest.Mock;

describe("ErrorScreen (S17 500)", () => {
  test("renders the Sentry ref when an event id exists", async () => {
    mockCapture.mockReturnValue("abc123");
    const screen = await renderScreen(<ErrorScreen error={new Error("boom")} onRetry={jest.fn()} />);
    expect(screen.getByText("Ref: abc123")).toBeTruthy();
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error));
  });

  test("keyless-degraded: no ref line when captureException returns undefined", async () => {
    mockCapture.mockReturnValue(undefined);
    const screen = await renderScreen(<ErrorScreen error={new Error("boom")} onRetry={jest.fn()} />);
    expect(screen.queryByText(/^Ref:/)).toBeNull();
    expect(screen.getByText("Something broke on our side")).toBeTruthy();
  });

  test("Try again fires onRetry", async () => {
    mockCapture.mockReturnValue(undefined);
    const onRetry = jest.fn();
    const screen = await renderScreen(<ErrorScreen error={new Error("boom")} onRetry={onRetry} />);
    fireEvent.press(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
