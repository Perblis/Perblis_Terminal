import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { hireKeys } from "../../lib/queries";
import { drainHandoverQueue } from "../../stores/handover-queue";

/**
 * Drains the D-016 offline handover queue on mount and whenever connectivity
 * returns, then refreshes the hires that got a record submitted. Renders
 * nothing — it lives in the shell so a queued capture uploads the moment the
 * device is back online, wherever the user is in the app.
 */
export function HandoverQueueDrainer() {
  const qc = useQueryClient();
  useEffect(() => {
    const run = async () => {
      const hireIds = await drainHandoverQueue();
      for (const id of hireIds) {
        void qc.invalidateQueries({ queryKey: hireKeys.handovers(id) });
        void qc.invalidateQueries({ queryKey: hireKeys.detail(id) });
      }
      if (hireIds.length) void qc.invalidateQueries({ queryKey: hireKeys.all });
    };
    void run();
    return onlineManager.subscribe((online) => {
      if (online) void run();
    });
  }, [qc]);
  return null;
}
