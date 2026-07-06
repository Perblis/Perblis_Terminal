import type { ReactNode } from "react";
import { Text, type TextProps } from "react-native";

type Props = TextProps & { className?: string; children?: ReactNode };

/** Body text — Inter, primary ink. */
export function BodyText({ className = "", ...rest }: Props) {
  return <Text className={`font-sans text-body text-text-primary ${className}`} {...rest} />;
}

/** Display text — Archivo semibold, for headings and heroes. */
export function DisplayText({ className = "", ...rest }: Props) {
  return <Text className={`font-display text-text-primary ${className}`} {...rest} />;
}

/** Mono text — IBM Plex Mono, for counters, codes, coordinates. */
export function MonoText({ className = "", ...rest }: Props) {
  return <Text className={`font-mono text-text-primary ${className}`} {...rest} />;
}

/**
 * Money — renders a server-sourced display string VERBATIM (design.md §9:
 * money is integer kobo on the wire; the API's `*_display` strings are the
 * only figures we show — never recompute). Mono, full value, never
 * abbreviated. `hero` scales it up as the dominant element (vision V2).
 */
export function Money({
  display,
  hero = false,
  className = "",
  ...rest
}: Omit<Props, "children"> & { display: string; hero?: boolean }) {
  return (
    <Text
      className={`font-mono text-text-money ${hero ? "text-money-hero" : "text-money"} ${className}`}
      {...rest}
    >
      {display}
    </Text>
  );
}
