"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2 select-none",
    "font-body font-medium rounded",
    "transition-colors duration-fast ease-standard",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-abyss",
    "disabled:opacity-40 disabled:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-forge text-text-on-accent hover:bg-forge-light active:bg-forge-mid",
        secondary:
          "bg-surface-elevated text-text-primary border border-border hover:bg-surface-high",
        ghost: "bg-transparent text-text-primary hover:bg-surface-high",
        danger: "bg-alert text-text-on-accent hover:bg-alert-soft active:bg-alert",
        link: "bg-transparent text-forge underline-offset-2 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-[14px]",
        lg: "h-12 px-5 text-[15px]",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(button({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
});
