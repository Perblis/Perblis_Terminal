import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeRoot } from "../components/shell/theme-root";

export default function RootLayout() {
  return (
    <ThemeRoot>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeRoot>
  );
}
