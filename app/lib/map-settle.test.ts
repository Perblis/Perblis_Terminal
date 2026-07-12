// Silent-flyTo settle gate: carousel pans must not refetch (the backend
// re-sorts by distance from the new centre and the carousel would jump), but
// user gestures must always refetch and a dropped settle must self-heal.
import { makeSettleGate } from "./map-settle";

jest.useFakeTimers();

test("a silent flyTo's animated settle is swallowed exactly once", () => {
  const gate = makeSettleGate();
  gate.markSilent();
  expect(gate.shouldPropagate(true)).toBe(false);
  expect(gate.shouldPropagate(true)).toBe(true); // mute consumed by the settle
});

test("without markSilent every settle propagates", () => {
  const gate = makeSettleGate();
  expect(gate.shouldPropagate(true)).toBe(true);
  expect(gate.shouldPropagate(false)).toBe(true);
});

test("a user gesture (animated: false) propagates even while muted", () => {
  const gate = makeSettleGate();
  gate.markSilent();
  expect(gate.shouldPropagate(false)).toBe(true);
});

test("the fallback timer un-mutes when the settle event is dropped", () => {
  const gate = makeSettleGate(1500);
  gate.markSilent();
  jest.advanceTimersByTime(1501);
  expect(gate.shouldPropagate(true)).toBe(true);
});

test("re-marking silent re-arms the timer", () => {
  const gate = makeSettleGate(1000);
  gate.markSilent();
  jest.advanceTimersByTime(800);
  gate.markSilent();
  jest.advanceTimersByTime(800); // 1600 total, but only 800 since re-arm
  expect(gate.shouldPropagate(true)).toBe(false);
});
