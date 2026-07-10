import "../global.css";

import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HandoverQueueDrainer } from "../components/shell/handover-queue-drainer";
import { QueryProvider } from "../components/shell/query-provider";
import { RealtimeInvalidator } from "../components/shell/realtime-invalidator";
import { SessionExpiredGate } from "../components/shell/session-expired-gate";
import { ThemeRoot } from "../components/shell/theme-root";
import { UpdateGate } from "../components/shell/update-gate";
import { ErrorScreen } from "../components/system/error-screen";
import { useAppFonts } from "../lib/fonts";
import { initSentry } from "../lib/sentry";

initSentry();

/**
 * S17 · Error 500. expo-router mounts this ABOVE RootLayout, so none of the
 * app's providers exist here — it brings its own SafeArea + theme wrappers
 * (ThemeRoot is self-contained) and ErrorScreen touches neither the router
 * nor the query client.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeRoot>
        <ErrorScreen error={error} onRetry={() => void retry()} />
      </ThemeRoot>
    </SafeAreaProvider>
  );
}

// Hold the native splash until fonts are ready (bundle-local — tens of ms).
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeRoot>
          <StatusBar style="auto" />
          <SessionExpiredGate />
          <HandoverQueueDrainer />
          <RealtimeInvalidator />
          <Stack screenOptions={{ headerShown: false }} />
          <UpdateGate />
        </ThemeRoot>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
