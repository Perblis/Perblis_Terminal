import { nativewindVars } from "@terminal/tokens";
import { useColorScheme } from "react-native";

/**
 * Raw semantic token values for the active system theme — for the places
 * NativeWind classes can't reach (SVG props, inline style colors). Same
 * remap ThemeRoot injects; never hardcode a theme's hex at a call site.
 */
export function useThemeTokens(): Record<string, string> {
  const scheme = useColorScheme();
  return nativewindVars[scheme === "dark" ? "dark" : "light"] as Record<string, string>;
}
