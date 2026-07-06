import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { AppState } from "react-native";

import { ApiError } from "../../lib/api";
import { queryStorage } from "../../storage/mmkv";

const HOUR = 60 * 60 * 1000;

// TanStack ↔ RN wiring: reachability drives online state, AppState drives
// refetch-on-focus.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * HOUR, // must exceed the persister maxAge
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const persister = createSyncStoragePersister({ storage: queryStorage });

// 8F offline posture (TSD §6): My Hires and Messages render cold. Only these
// families dehydrate — map/search noise stays out of MMKV.
const PERSIST_ALLOWLIST = ["hires", "hire", "conversations", "messages", "me"];

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * HOUR,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            PERSIST_ALLOWLIST.includes(String(query.queryKey[0])),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
