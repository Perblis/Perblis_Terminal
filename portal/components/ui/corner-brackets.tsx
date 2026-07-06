import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * D-021 corner-bracket panel: thin L-shaped registration marks framing key
 * money/trust panels (stat cards, LockedTerms, the bank vault). One motif per
 * screen (01 §2) — the consumer is responsible for restraint.
 */
export function CornerBracketPanel({
  className,
  inverse = false,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { inverse?: boolean }) {
  const stroke = inverse ? "border-ink-600" : "border-ink-200";
  const arm = "pointer-events-none absolute size-s3 border-0";
  return (
    <div className={cn("relative", className)} {...rest}>
      <span aria-hidden className={cn(arm, stroke, "left-0 top-0 border-l-[1.5px] border-t-[1.5px]")} />
      <span aria-hidden className={cn(arm, stroke, "right-0 top-0 border-r-[1.5px] border-t-[1.5px]")} />
      <span aria-hidden className={cn(arm, stroke, "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]")} />
      <span aria-hidden className={cn(arm, stroke, "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]")} />
      {children}
    </div>
  );
}
