import { cn } from "@/lib/cn";

/** Button-internal spinner (05 §4: circular progress lives only here). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-s4 animate-spin rounded-pill border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
