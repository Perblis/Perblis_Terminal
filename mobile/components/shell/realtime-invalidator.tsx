import { useQueryClient } from "@tanstack/react-query";

import { hireKeys } from "../../lib/queries";
import { useRealtimeChannel } from "../../lib/realtime";
import { useSession } from "../../stores/session";

/**
 * Subscribes to the caller's `user:{id}` channel (badge/unread + hire-status
 * fan-out) and refreshes the affected query families. No-op when realtime is
 * degraded (polling still runs). Renders nothing; mounted app-wide in the shell.
 */
export function RealtimeInvalidator() {
  const qc = useQueryClient();
  const me = useSession((s) => s.me);
  useRealtimeChannel(me ? `user:${me.id}` : null, () => {
    void qc.invalidateQueries({ queryKey: ["conversations"] });
    void qc.invalidateQueries({ queryKey: hireKeys.all });
  });
  return null;
}
