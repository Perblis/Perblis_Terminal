import { useEffect } from "react";

import { hasSession } from "../../lib/api";
import { fetchMe } from "../../lib/auth-api";
import { useSession } from "../../stores/session";

/**
 * Cold-start session reconciliation: the persisted `me` renders instantly,
 * then this checks the SecureStore refresh token and refreshes `me` from the
 * server. No token ⇒ guest (drops a stale persisted `me` after a sign-out
 * elsewhere). Fetch failure (offline/5xx) keeps the persisted `me` — a dead
 * refresh token is already handled inside apiFetch (tokens cleared +
 * session-expired emitted → SessionExpiredGate), so nothing is masked here.
 */
export function SessionHydrator() {
  const setMe = useSession((s) => s.setMe);
  const setHydrated = useSession((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!(await hasSession())) {
          if (!cancelled) setMe(null);
          return;
        }
        const me = await fetchMe();
        if (!cancelled) setMe(me);
      } catch {
        // Offline or transient server error: keep the persisted me.
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setMe, setHydrated]);

  return null;
}
