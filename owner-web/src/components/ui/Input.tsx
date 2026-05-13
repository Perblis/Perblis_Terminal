import * as React from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "bg-surface-elevated text-text-primary font-body h-10 w-full rounded border px-3",
        "placeholder:text-text-tertiary",
        "focus:border-border-active focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        invalid ? "border-alert" : "border-border",
        className,
      )}
      {...props}
    />
  );
});
