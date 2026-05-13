import { cn } from "@/lib/cn";

import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  const deltaColor =
    deltaTone === "positive"
      ? "text-clear-soft"
      : deltaTone === "negative"
        ? "text-alert-soft"
        : "text-text-secondary";

  return (
    <Card className={cn("space-y-1", className)}>
      <div className="text-text-tertiary text-[11px] tracking-[0.06em] uppercase">{label}</div>
      <div className="text-text-primary font-mono text-[22px] font-semibold">{value}</div>
      {delta ? <div className={cn("font-mono text-[11px]", deltaColor)}>{delta}</div> : null}
    </Card>
  );
}
