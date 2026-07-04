import { Lock } from "lucide-react";

import { CornerBracketPanel } from "@/components/ui/corner-brackets";
import type { Hire } from "@/lib/types";

/**
 * LockedTerms, SUPPLIER variant (06 §1 / M2 manifest block) — D-014's one
 * portal home: Hire value → Service fee (fee_basis caption) → **You receive**
 * hero. Every figure is the server's *_display string rendered verbatim —
 * this component does no arithmetic (wave-7 mandatory test).
 */
export function LockedTerms({ hire, lockedAt }: { hire: Hire; lockedAt?: string | null }) {
  const locked = !["requested"].includes(hire.status);
  return (
    <CornerBracketPanel className="bg-surface-card p-s5">
      <p className="font-display text-overline uppercase tracking-[0.1em] text-ink-500">
        {locked ? "You receive" : "Estimated — final at acceptance"}
      </p>
      <p className="mt-s2 font-mono text-display-xl font-medium text-text-primary">
        {hire.payout_amount_display ?? "—"}
      </p>

      <div className="mt-s4 border-t border-border-default pt-s3 text-body-sm">
        <div className="flex justify-between py-s1">
          <span className="text-text-secondary">Hire value</span>
          <span className="font-mono">{hire.hire_value_display}</span>
        </div>
        <div className="flex justify-between py-s1">
          <span className="text-text-secondary">
            Service fee{hire.fee_basis ? <span className="text-ink-500"> · {hire.fee_basis}</span> : null}
          </span>
          <span className="font-mono">−{hire.service_fee_display ?? "—"}</span>
        </div>
        <div className="mt-s2 flex justify-between border-t-2 border-border-structural pt-s2 font-medium">
          <span>You receive</span>
          <span className="font-mono">{hire.payout_amount_display ?? "—"}</span>
        </div>
      </div>

      {locked && lockedAt ? (
        <p className="mt-s3 flex items-center gap-s1 text-caption text-ink-500">
          <Lock size={12} aria-hidden />
          Terms locked{" "}
          {new Date(lockedAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
    </CornerBracketPanel>
  );
}
