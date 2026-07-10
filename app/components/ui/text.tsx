import type { ReactNode } from "react";
import { Text, type TextProps } from "react-native";

type Props = TextProps & { className?: string; children?: ReactNode };

/**
 * A caller-supplied text colour (semantic `text-text-*` or a primitive ramp
 * like `text-amber-900`). When present, the primitive must NOT also emit its
 * default colour: NativeWind resolves conflicting colour utilities by
 * stylesheet order, not className order, so `text-text-primary` can silently
 * beat the caller's class — in dark mode that renders near-white text on
 * light chips/pills (the class of contrast bug behind the map "N assets"
 * pill and badge counts).
 */
const TEXT_COLOR_CLASS = /(?:^|\s)text-(?:text-|(?:ink|paper|amber|blue|green|red|teal|violet|earth)-)/;

function withDefaultColor(className: string, defaultColor: string): string {
  return TEXT_COLOR_CLASS.test(className) ? className : `${defaultColor} ${className}`;
}

/** Body text — Inter; primary ink unless the caller sets a colour. */
export function BodyText({ className = "", ...rest }: Props) {
  return (
    <Text className={`font-sans text-body ${withDefaultColor(className, "text-text-primary")}`} {...rest} />
  );
}

/** Display text — Archivo semibold, for headings and heroes. */
export function DisplayText({ className = "", ...rest }: Props) {
  return (
    <Text className={`font-display ${withDefaultColor(className, "text-text-primary")}`} {...rest} />
  );
}

/** Mono text — IBM Plex Mono, for counters, codes, coordinates. */
export function MonoText({ className = "", ...rest }: Props) {
  return (
    <Text className={`font-mono ${withDefaultColor(className, "text-text-primary")}`} {...rest} />
  );
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
      className={`font-mono ${hero ? "text-money-hero" : "text-money"} ${withDefaultColor(className, "text-text-money")}`}
      {...rest}
    >
      {display}
    </Text>
  );
}
