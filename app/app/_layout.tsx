import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HandoverQueueDrainer } from "../components/shell/handover-queue-drainer";
import { QueryProvider } from "../components/shell/query-provider";
import { SessionExpiredGate } from "../components/shell/session-expired-gate";
import { ThemeRoot } from "../components/shell/theme-root";
import { useAppFonts } from "../lib/fonts";
import { initSentry } from "../lib/sentry";

initSentry();

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
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeRoot>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
