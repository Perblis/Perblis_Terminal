import * as React from "react";

import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  density?: "compact" | "default" | "spacious";
  accent?: "forge" | "clear" | "signal" | "amber" | "alert" | null;
  elevated?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, density = "default", accent = null, elevated = false, ...props },
  ref,
) {
  const pad = density === "compact" ? "p-3" : density === "spacious" ? "p-5" : "p-4";
  const accentClass = accent
    ? {
        forge: "border-l-[3px] border-l-forge pl-3",
        clear: "border-l-[3px] border-l-clear pl-3",
        signal: "border-l-[3px] border-l-signal pl-3",
        amber: "border-l-[3px] border-l-amber pl-3",
        alert: "border-l-[3px] border-l-alert pl-3",
      }[accent]
    : "";

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-card border-border border",
        elevated ? "bg-surface-elevated" : "bg-surface",
        pad,
        accentClass,
        className,
      )}
      {...props}
    />
  );
});
