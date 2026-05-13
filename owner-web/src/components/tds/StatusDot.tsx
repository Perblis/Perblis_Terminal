import { cn } from "@/lib/cn";

const colorMap = {
  active: "bg-forge",
  available: "bg-clear",
  pending: "bg-amber",
  declined: "bg-alert",
  confirmed: "bg-signal",
  completed: "bg-text-tertiary",
  paused: "bg-text-tertiary",
  draft: "bg-text-tertiary",
  archived: "bg-text-tertiary",
  cancelled: "bg-alert",
  maintenance: "bg-amber",
} as const;

export type StatusDotStatus = keyof typeof colorMap;

export function StatusDot({
  status,
  size = 8,
  className,
}: {
  status: StatusDotStatus;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn("inline-block shrink-0 rounded-full", colorMap[status], className)}
    />
  );
}
