// Wave-8 mandatory: countdown hooks under frozen time.
import { renderHook, act } from "@testing-library/react-native";

import { countdownParts, useCountdown } from "./use-countdown";

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-06T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("hours-scale label for the 24h request window", () => {
  const parts = countdownParts("2026-07-06T15:12:45Z", Date.now());
  expect(parts.label).toBe("3h 12m");
  expect(parts.expired).toBe(false);
});

test("mm:ss label under an hour, zero-padded", () => {
  expect(countdownParts("2026-07-06T12:12:04Z", Date.now()).label).toBe("12:04");
  expect(countdownParts("2026-07-06T12:00:59Z", Date.now()).label).toBe("0:59");
});

test("expired clamps to zero and flags", () => {
  const parts = countdownParts("2026-07-06T11:59:00Z", Date.now());
  expect(parts).toMatchObject({ totalSeconds: 0, expired: true, label: "0:00" });
});

test("useCountdown ticks with time", async () => {
  const { result } = await renderHook(() => useCountdown("2026-07-06T12:01:00Z"));
  expect(result.current?.label).toBe("1:00");
  await act(async () => {
    jest.advanceTimersByTime(61_000);
  });
  expect(result.current?.expired).toBe(true);
});
