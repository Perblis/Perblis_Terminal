import { cn } from "@/lib/cn";

/**
 * Brand lockups per 01 §1. The plate (amber wordmark on ink-900, r-sm) is the
 * portal nav-rail mark; the T-crane glyph carries small sizes. NOTE: the
 * founder wants to workshop a rounded-square excavator mark during 7A
 * (wave-7-vision.md) — until that session, the spec'd plate stands.
 */
export function TCrane({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path d="M4 5h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
      <path d="M9 5v15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
      <path d="M18 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <rect x="16.25" y="9" width="3.5" height="3" fill="currentColor" />
    </svg>
  );
}

export function WordmarkPlate({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-s2 rounded-sm bg-surface-inverse text-amber-500",
        compact ? "p-s2" : "px-s3 py-s2",
        className,
      )}
    >
      <TCrane size={compact ? 20 : 16} />
      {compact ? null : (
        <span className="font-display text-body-sm font-semibold uppercase tracking-[0.08em]">
          Terminal
        </span>
      )}
    </span>
  );
}

/** Inline lockup for light surfaces: amber tick-bar + ink wordmark. */
export function WordmarkInline({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none items-center gap-s2", className)}>
      <span aria-hidden className="h-[18px] w-s1 bg-amber-500" />
      <span className="font-display text-body font-semibold uppercase tracking-[0.08em] text-text-primary">
        Terminal
      </span>
    </span>
  );
}
