"use client";

// Live fan-out → query invalidation: user:{id} carries unread bumps and
// hire-status changes (hires/state.py publishes there). Polling intervals
// remain the safety net.
import { useQueryClient } from "@tanstack/react-query";

import { useMe } from "@/lib/queries";
import { useRealtimeChannel } from "@/lib/realtime";

export function RealtimeInvalidator() {
  const me = useMe();
  const qc = useQueryClient();
  useRealtimeChannel(me.data ? `user:${me.data.id}` : null, () => {
    void qc.invalidateQueries({ queryKey: ["conversations"] });
    void qc.invalidateQueries({ queryKey: ["unread-total"] });
    void qc.invalidateQueries({ queryKey: ["hires"] });
    void qc.invalidateQueries({ queryKey: ["hire-stats"] });
    void qc.invalidateQueries({ queryKey: ["hire-events"] });
  });
  return null;
}
