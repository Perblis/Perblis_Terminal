import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Inline full-width wash banner (05 §4). */
export function Banner({
  tone,
  children,
  action,
  className,
}: {
  tone: "info" | "warning" | "danger";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "info" ? Info : tone === "warning" ? AlertTriangle : OctagonAlert;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-s3 rounded-sm border px-s4 py-s3 text-body-sm",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-900",
        tone === "warning" && "border-amber-100 bg-amber-50 text-amber-900",
        tone === "danger" && "border-red-100 bg-red-50 text-red-900",
        className,
      )}
    >
      <Icon size={18} className="mt-px shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
