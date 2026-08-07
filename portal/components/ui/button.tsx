"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./spinner";

/** Buttons per design-system 05 §1 — bespoke, tokens-only (D-019). */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "lg" | "md" | "sm";
  loading?: boolean;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-action-primary text-text-on-brand hover:bg-action-primary-hover active:bg-action-primary-active disabled:bg-ink-700 disabled:text-ink-400",
  secondary:
    "border border-border-strong bg-transparent text-text-primary hover:bg-ink-800 active:bg-ink-700 disabled:border-border-default disabled:text-ink-400",
  destructive:
    "bg-action-destructive text-text-inverse hover:bg-red-400 active:bg-red-600 disabled:bg-ink-700 disabled:text-ink-400",
  ghost: "bg-transparent text-text-secondary hover:bg-ink-800 active:bg-ink-700 disabled:text-ink-400",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  lg: "h-12 px-s5 text-body",
  md: "h-10 px-s4 text-body-sm",
  sm: "h-8 px-s3 text-body-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex min-w-[88px] select-none items-center justify-center gap-s2 rounded-sm font-medium",
        "transition-[background-color,transform] duration-micro ease-out active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {/* L state: spinner replaces the label, width stays locked (05 §1). */}
      <span className={cn("inline-flex items-center gap-s2", loading && "invisible")}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
});
