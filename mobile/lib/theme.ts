import { nativewindVars } from "@terminal/tokens";

/**
 * Raw semantic token values — for the places NativeWind classes can't reach
 * (SVG props, inline style colors). Same map ThemeRoot injects; never
 * hardcode a theme's hex at a call site.
 *
 * Dark-only since the Infisical port (D-028), matching ThemeRoot.
 */
export function useThemeTokens(): Record<string, string> {
  return nativewindVars.dark as Record<string, string>;
}
