import { nativewindVars } from "@terminal/tokens";
import { vars } from "nativewind";
import type { ReactNode } from "react";
import { View } from "react-native";

const darkVars = vars(nativewindVars.dark);

/**
 * Injects the semantic token CSS variables so the tokens preset's semantic
 * classes (bg-surface-page, text-text-primary, border-border-default, …) resolve.
 *
 * The app is **dark-only** since the Infisical design-system port (D-028) —
 * the skin is built on a near-black ground and its acid-lime accent only
 * works there, so the system colour scheme is deliberately not consulted.
 * The light token map still exists (email, print receipts, Ops admin); it is
 * simply never selected here. To follow the system again, read
 * `useColorScheme()` and index `nativewindVars` with it, as before.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  return <View style={[{ flex: 1 }, darkVars]}>{children}</View>;
}
