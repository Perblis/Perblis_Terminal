import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Card per 05 §7: paper-0, 1px border, r-md, e-0 (borders carry structure). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-border-default bg-surface-card p-s4", className)}
      {...rest}
    />
  );
}
