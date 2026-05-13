import { cn } from "@/lib/cn";

/**
 * Status indicator dot. Color encodes a state token (not a category).
 *
 * Per TDS: status uses color sparingly — typically pair with a label
 * so the dot is supplementary, not the only signal.
 */
type StatusTone = "clear" | "signal" | "alert" | "amber" | "neutral" | "forge";

const TONE: Record<StatusTone, string> = {
  clear: "bg-clear",
  signal: "bg-signal",
  alert: "bg-alert",
  amber: "bg-amber",
  forge: "bg-forge",
  neutral: "bg-border-active",
};

export function StatusDot({
  tone = "neutral",
  className,
}: {
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("rounded-pill inline-block size-2", TONE[tone], className)} />
  );
}
