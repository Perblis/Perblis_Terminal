// The regression guard for the "search is broken on the APK" report: typing a
// word used to be one request per character (two, with the map mounted behind
// the search screen) against a 60/min throttle, and the resulting 429 rendered
// as "Couldn't load results".
//
// RNTL v14 renders asynchronously — renderHook, rerender and act all have to
// be awaited, and `result.current` is assigned in an effect, so it is only
// populated once a render has committed.
import { act, renderHook } from "@testing-library/react-native";

import { COMMIT_DELAY_MS, useDebouncedCommit } from "./use-debounced-commit";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Advance fake timers inside act so the resulting re-render is flushed. */
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

test("a burst of keystrokes commits once, with the final value", async () => {
  const commit = jest.fn();
  const { result } = await renderHook(() => useDebouncedCommit("", commit));

  for (const value of ["e", "ex", "exc", "exca", "excav"]) {
    await act(async () => result.current[1](value));
  }

  // The field is live even though nothing has been committed yet.
  expect(result.current[0]).toBe("excav");
  expect(commit).not.toHaveBeenCalled();

  await tick(COMMIT_DELAY_MS);

  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith("excav");
});

test("each keystroke restarts the window rather than queueing a commit", async () => {
  const commit = jest.fn();
  const { result } = await renderHook(() => useDebouncedCommit("", commit));

  await act(async () => result.current[1]("cra"));
  await tick(COMMIT_DELAY_MS - 50);
  await act(async () => result.current[1]("crane"));
  await tick(COMMIT_DELAY_MS - 50);

  expect(commit).not.toHaveBeenCalled();

  await tick(50);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith("crane");
});

test("reset commits immediately and cancels the pending commit", async () => {
  const commit = jest.fn();
  const { result } = await renderHook(() => useDebouncedCommit("", commit));

  await act(async () => result.current[1]("crane"));
  // Chip dismissal / "Clear all" must land now, not in 300ms.
  await act(async () => result.current[2](""));

  expect(result.current[0]).toBe("");
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith("");

  await tick(COMMIT_DELAY_MS);
  // "crane" never lands — otherwise clearing a filter would re-apply it.
  expect(commit).toHaveBeenCalledTimes(1);
});

test("an external change to the committed value pulls the draft with it", async () => {
  const commit = jest.fn();
  const { result, rerender } = await renderHook(
    ({ committed }: { committed: string }) => useDebouncedCommit(committed, commit),
    { initialProps: { committed: "crane" } },
  );

  expect(result.current[0]).toBe("crane");

  // The map's "clear search" button writes the store directly.
  await act(async () => rerender({ committed: "" }));
  expect(result.current[0]).toBe("");
});

test("a stale committed value never clobbers in-flight typing", async () => {
  const commit = jest.fn();
  const { result, rerender } = await renderHook(
    ({ committed }: { committed: string }) => useDebouncedCommit(committed, commit),
    { initialProps: { committed: "" } },
  );

  await act(async () => result.current[1]("excav"));
  // A re-render carrying the older store value arrives mid-window.
  await act(async () => rerender({ committed: "" }));

  expect(result.current[0]).toBe("excav");
});
