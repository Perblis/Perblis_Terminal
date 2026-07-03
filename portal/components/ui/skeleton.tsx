import { cn } from "@/lib/cn";

/** Content-shaped loading block (05 §4). Shapes mirror the real layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-sm", className)} />;
}
