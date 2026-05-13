"use client";

import * as RLabel from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ComponentRef<typeof RLabel.Root>,
  React.ComponentPropsWithoutRef<typeof RLabel.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <RLabel.Root
      ref={ref}
      className={cn(
        "text-text-secondary text-[11px] font-medium tracking-[0.06em] uppercase",
        className,
      )}
      {...props}
    />
  );
});
