import { router } from "expo-router";
import { useEffect } from "react";

import { onAccountSuspended } from "../../lib/api";
import { useSession } from "../../stores/session";

/**
 * F12: any API response carrying `account_suspended` replaces the whole
 * stack with the S17 blocking screen — a suspended account has nothing to
 * come back to until Ops lifts it.
 */
export function SuspendedGate() {
  const setMe = useSession((s) => s.setMe);

  useEffect(
    () =>
      onAccountSuspended(() => {
        setMe(null);
        router.replace("/system/suspended");
      }),
    [setMe],
  );

  return null;
}
