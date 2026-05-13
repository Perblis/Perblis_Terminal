"use client";

import { cn } from "@/lib/cn";

import { Label } from "./Label";

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-alert-soft font-body text-[12px]">{error}</p>
      ) : hint ? (
        <p className="text-text-tertiary font-body text-[12px]">{hint}</p>
      ) : null}
    </div>
  );
}
