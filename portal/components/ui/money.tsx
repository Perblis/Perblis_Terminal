import { cn } from "@/lib/cn";

/**
 * Money typesetting (03 §3, normative): Plex Mono 500, ₦ + grouped digits,
 * kobo never displayed, full value always (₦1,250,000 — never ₦1.25M here).
 * Values arrive as integer kobo from the API and are floored to whole naira —
 * the portal NEVER recomputes money, only renders server figures.
 */
export function formatNaira(kobo: number): string {
  const naira = Math.floor(Math.abs(kobo) / 100);
  const sign = kobo < 0 ? "−" : ""; // true minus, never parentheses
  return `${sign}₦${naira.toLocaleString("en-NG")}`;
}

export function Money({
  kobo,
  display,
  className,
}: {
  /** Integer kobo from the API. */
  kobo?: number;
  /** Pre-formatted server display string (preferred when the API sends one). */
  display?: string;
  className?: string;
}) {
  const text = display ?? (kobo !== undefined ? formatNaira(kobo) : "—");
  return <span className={cn("font-mono font-medium text-text-primary", className)}>{text}</span>;
}
