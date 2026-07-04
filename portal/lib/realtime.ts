"use client";

// Ably realtime (D-011, TSD §4) — fan-out only; Postgres stays the message of
// record and every consumer keeps its polling interval, so a keyless backend
// (`not_configured`) or a dropped socket degrades silently to 15s polling with
// no UI difference beyond latency (F7).
import type * as AblyTypes from "ably";
import { useEffect } from "react";

import { bff } from "./api";

let clientPromise: Promise<AblyTypes.Realtime | null> | null = null;

async function createClient(): Promise<AblyTypes.Realtime | null> {
  try {
    const token = await bff<Record<string, unknown> & { status?: string }>("/realtime/token");
    if (token.status === "not_configured") return null;
    const Ably = await import("ably");
    return new Ably.Realtime({
      authCallback: (_params, callback) => {
        bff<AblyTypes.TokenRequest>("/realtime/token")
          .then((tr) => callback(null, tr as AblyTypes.TokenRequest))
          .catch((err: Error) => callback(err.message, null));
      },
    });
  } catch {
    return null; // polling stands
  }
}

export function getRealtime(): Promise<AblyTypes.Realtime | null> {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}

/** Subscribe to a channel for the component's lifetime; noop when degraded. */
export function useRealtimeChannel(channel: string | null, onMessage: () => void) {
  useEffect(() => {
    if (!channel) return;
    let disposed = false;
    let bound: AblyTypes.RealtimeChannel | null = null;
    const handler = () => onMessage();
    void getRealtime().then((client) => {
      if (!client || disposed) return;
      bound = client.channels.get(channel);
      void bound.subscribe(handler);
    });
    return () => {
      disposed = true;
      bound?.unsubscribe(handler);
    };
    // onMessage is intentionally captured once per channel binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);
}
