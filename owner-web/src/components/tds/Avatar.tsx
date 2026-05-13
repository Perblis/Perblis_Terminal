"use client";

import * as A from "@radix-ui/react-avatar";

import { cn } from "@/lib/cn";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = getInitials(name || "?");

  return (
    <A.Root
      style={{ width: size, height: size }}
      className={cn(
        "border-border bg-surface-elevated inline-flex items-center justify-center overflow-hidden rounded-full border",
        className,
      )}
    >
      {src ? <A.Image src={src} alt={name} className="h-full w-full object-cover" /> : null}
      <A.Fallback
        className="text-text-secondary font-body"
        style={{ fontSize: Math.max(10, size / 2.6) }}
      >
        {initials}
      </A.Fallback>
    </A.Root>
  );
}
