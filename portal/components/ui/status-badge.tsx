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
  requested: "bg-amber-100 text-amber-900",
  accepted: "bg-blue-50 text-blue-900",
  confirmed: "bg-teal-50 text-teal-900",
  on_hire: "bg-green-600 text-text-inverse",
  completed: "bg-ink-100 text-ink-600",
  declined: "border border-ink-300 bg-transparent text-ink-500",
  expired: "border border-ink-300 bg-transparent text-ink-500",
  cancelled: "bg-red-50 text-red-900",
  in_dispute: "bg-violet-50 text-violet-900",
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

/** Count badge (05 §4): unread amber, urgent red. */
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
        urgent ? "bg-red-600 text-text-inverse" : "bg-amber-500 text-text-on-brand",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
