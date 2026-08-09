// Local draft + debounced commit to shared state.
//
// Why this exists: the search screen bound its TextInputs straight to the
// shared map-state store (`onChangeText={setQ}`). Every keystroke changed the
// store, which changed the TanStack query key, which fired a request — and
// because expo-router keeps the map tab mounted behind the pushed /search
// route, `useMapSearch` fired a *second* one. Typing "excavator" was 18
// requests against a 60/min `search_anon` throttle, and `query-provider`
// declines to retry anything under 500, so the resulting 429 landed the user
// on "Couldn't load results".
//
// The fix is the standard split: the input owns a *draft* that updates on every
// keystroke (so typing stays instant), and the shared store only receives the
// *committed* value once typing settles. Everything downstream — query keys,
// filter chips, the map — reads committed state and therefore moves once.
import { useCallback, useEffect, useRef, useState } from "react";

/** Long enough to absorb a burst of typing, short enough to feel live. */
export const COMMIT_DELAY_MS = 300;

export type DebouncedCommit = [
  /** Draft value — bind this to the input. */
  draft: string,
  /** Keystroke handler: updates the draft now, commits after the delay. */
  onChange: (next: string) => void,
  /** Cancel any pending commit and set both draft and store at once
   *  (used by "Clear all" and the dismissible chips, which must be instant). */
  reset: (next: string) => void,
];

export function useDebouncedCommit(
  committed: string,
  commit: (next: string) => void,
  delay: number = COMMIT_DELAY_MS,
): DebouncedCommit {
  const [draft, setDraft] = useState(committed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  // Keep `commit` fresh without making the callbacks below re-identify on
  // every render (zustand setters are stable, but callers needn't guarantee it).
  // Assigned in an effect, not during render: `commit` is only ever invoked
  // from a timer or an event handler, both of which run after effects have
  // flushed, so the ref is always current by the time it is read.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Pull the draft back in sync when the store changes from elsewhere — but
  // never while a commit is in flight, or the older committed value would
  // clobber what the user has typed since.
  useEffect(() => {
    if (!pending.current) setDraft(committed);
  }, [committed]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onChange = useCallback(
    (next: string) => {
      setDraft(next);
      pending.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pending.current = false;
        commitRef.current(next);
      }, delay);
    },
    [delay],
  );

  const reset = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = false;
    setDraft(next);
    commitRef.current(next);
  }, []);

  return [draft, onChange, reset];
}
