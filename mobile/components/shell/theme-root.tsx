import { nativewindVars } from "@terminal/tokens";
import { vars } from "nativewind";
import type { ReactNode } from "react";
import { View, useColorScheme } from "react-native";

const themeVars = {
  light: vars(nativewindVars.light),
  dark: vars(nativewindVars.dark),
};

/**
 * Injects the semantic token CSS variables for the active system theme so
 * the tokens preset's semantic classes (bg-surface-page, text-text-primary,
 * border-border, …) resolve per theme (wave-8-vision V1).
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return (
    <View style={[{ flex: 1 }, themeVars[scheme === "dark" ? "dark" : "light"]]}>
      {children}
    </View>
  );
}
