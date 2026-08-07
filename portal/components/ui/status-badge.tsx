import { Lock } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Hire status badges per 02 §4 + the 09 §3 supplier status vocabulary — the
 * only status language. On Hire is deliberately the only solid badge.
 */
export type HireStatus =
  | "requested"
  | "accepted"
  | "confirmed"
  | "on_hire"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled"
  | "in_dispute";

const styles: Record<HireStatus, string> = {
  requested: "bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-500/25",
  accepted: "bg-blue-400/12 text-blue-300 ring-1 ring-inset ring-blue-400/25",
  confirmed: "bg-teal-400/12 text-teal-300 ring-1 ring-inset ring-teal-400/25",
  on_hire: "bg-green-500 text-ink-950",
  completed: "bg-ink-700 text-ink-300",
  declined: "bg-transparent text-text-tertiary ring-1 ring-inset ring-border-default",
  expired: "bg-transparent text-text-tertiary ring-1 ring-inset ring-border-default",
  cancelled: "bg-red-500/12 text-red-300 ring-1 ring-inset ring-red-500/25",
  in_dispute: "bg-violet-400/12 text-violet-300 ring-1 ring-inset ring-violet-400/25",
};

const supplierLabels: Record<HireStatus, string> = {
  requested: "Action needed",
  accepted: "Awaiting payment",
  confirmed: "Confirmed",
  on_hire: "On hire",
  completed: "Completed",
  declined: "You declined",
  expired: "Expired",
  cancelled: "Cancelled",
  in_dispute: "In dispute",
};

export function StatusBadge({ status, className }: { status: HireStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-s1 rounded-pill px-s2 py-px text-caption font-medium",
        styles[status],
        className,
      )}
    >
      {status === "in_dispute" ? <Lock size={12} aria-hidden /> : null}
      {supplierLabels[status]}
    </span>
  );
}

/** Count badge (05 §4): unread brand, urgent red. */
export function CountBadge({
  count,
  urgent = false,
  className,
}: {
  count: number;
  urgent?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-pill px-s1 text-caption font-semibold leading-[18px]",
        urgent ? "bg-red-500 text-ink-950" : "bg-action-primary text-text-on-brand",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
