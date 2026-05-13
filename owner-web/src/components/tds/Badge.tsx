import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "info" | "warn" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-high text-text-secondary border-border",
  success: "bg-clear-dim text-clear-soft border-clear-dim",
  info: "bg-signal-dim text-signal-soft border-signal-dim",
  warn: "bg-amber-dim text-amber border-amber-dim",
  danger: "bg-alert-dim text-alert-soft border-alert-dim",
  accent: "bg-forge-dim text-forge-light border-forge-dim",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-pill inline-flex h-5 items-center border px-2 text-[11px] font-medium tracking-[0.06em] uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
