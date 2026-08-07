import { router } from "expo-router";
import { useEffect } from "react";

import { onSessionExpired } from "../../lib/api";
import { useSession } from "../../stores/session";

/**
 * F12: a dead refresh anywhere pushes the auth sheet OVER the current
 * screen (stack preserved — signing back in pops home to where the user
 * was, intent intact).
 */
export function SessionExpiredGate() {
  const setMe = useSession((s) => s.setMe);

  useEffect(
    () =>
      onSessionExpired(() => {
        setMe(null);
        router.push("/auth/login?reauth=1");
      }),
    [setMe],
  );

  return null;
}
