"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";

import { initSentry } from "@/lib/sentry";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => initSentry(), []);
  // One client per browser tab; created lazily so SSR never shares state.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The BFF already retries once through the refresh path; a second
            // network retry covers blips without hammering a down API.
            retry: 1,
            staleTime: 15_000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
    </QueryClientProvider>
  );
}
