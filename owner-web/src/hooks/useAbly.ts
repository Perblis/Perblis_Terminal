"use client";

import { useCallback, useEffect, useRef } from "react";
import * as Ably from "ably";
import { messagingApi } from "@/lib/api/messaging";

let clientPromise: Promise<Ably.Realtime> | null = null;

async function getAblyClient(): Promise<Ably.Realtime> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const client = new Ably.Realtime({
      authCallback: async (_data, cb) => {
        try {
          const res = await messagingApi.ablyToken();
          const tokenStr = res.token?.token;
          if (!tokenStr) {
            cb("No Ably token available", null);
            return;
          }
          cb(null, tokenStr);
        } catch (err) {
          cb(String(err), null);
        }
      },
      autoConnect: true,
    });
    return client;
  })();
  return clientPromise;
}

export function useAblyChannel(
  channelName: string | null,
  onMessage: (msg: Ably.Message) => void,
) {
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const stableListener = useCallback((m: Ably.Message) => handlerRef.current(m), []);

  useEffect(() => {
    if (!channelName) return;
    let cancelled = false;
    let channel: Ably.RealtimeChannel | null = null;

    (async () => {
      try {
        const client = await getAblyClient();
        if (cancelled) return;
        channel = client.channels.get(channelName);
        channel.subscribe(stableListener);
      } catch {
        // Ably not configured — degrade silently in dev
      }
    })();

    return () => {
      cancelled = true;
      if (channel) channel.unsubscribe(stableListener);
    };
  }, [channelName, stableListener]);
}
