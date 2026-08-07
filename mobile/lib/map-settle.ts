/**
 * Settle gate for programmatic "silent" camera moves. A carousel swipe pans
 * the map to the selected pin, but that pan must NOT refetch the viewport —
 * the backend re-sorts results by distance from the map centre, and a
 * reordered payload makes the carousel jump under the user's finger. The
 * gate mutes exactly one settle: the animated settle of the silent flyTo.
 *
 * MapLibre RN caveat (Android CameraChangeTracker): `userInteraction` is true
 * for developer animations too, so it can't tell a flyTo from a finger pan.
 * `animated` is true only for developer/SDK animations — a user gesture
 * settles with `animated: false` — so a gesture that interrupts the silent
 * flight always propagates and refetches. A fallback timer un-mutes if the
 * settle event is dropped, so refetches can never be muted permanently.
 */
export function makeSettleGate(timeoutMs = 1500) {
  let silent = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    silent = false;
  };

  return {
    /** A silent programmatic move is starting — mute its settle. */
    markSilent() {
      if (timer) clearTimeout(timer);
      silent = true;
      timer = setTimeout(clear, timeoutMs);
    },
    /** Called on every region settle; true ⇒ propagate (fetch), false ⇒ swallow. */
    shouldPropagate(animated: boolean) {
      const swallow = silent && animated;
      clear(); // one-shot: any settle consumes the mute
      return !swallow;
    },
    /** Drop the pending timer (unmount). */
    dispose: clear,
  };
}

export type SettleGate = ReturnType<typeof makeSettleGate>;
