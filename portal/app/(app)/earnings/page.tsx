"use client";

// P13 · Earnings. The money page the dashboard summarises: month figures up
// top, then every payout line — state, kind, reference — so a supplier can
// reconcile what Terminal owes and has paid without asking Ops. Supplier-side
// figures only (D-014 governs hirer surfaces; payouts are inherently supplier data).
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { CornerBracketPanel } from "@/components/ui/corner-brackets";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { usePayouts, type Payout } from "@/lib/queries";

type StateFilter = "all" | "pending" | "due" | "paid" | "frozen";

const STATE_LABEL: Record<string, string> = {
  pending: "Queued",
  due: "Due",
  paid: "Paid",
  frozen: "On hold",
};

const STATE_PILL: Record<string, string> = {
  pending: "bg-ink-100 text-text-secondary",
  due: "bg-amber-100 text-amber-900",
  paid: "bg-green-100 text-green-900",
  frozen: "bg-violet-100 text-violet-900",
};

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <CornerBracketPanel className="h-full bg-surface-card p-s4">
      <p className="font-display text-overline uppercase tracking-[0.1em] text-ink-500">{label}</p>
      <p className="mt-s2 truncate font-mono text-display-xl font-medium text-text-primary">{value}</p>
      {caption ? <p className="mt-s1 truncate text-caption text-ink-500">{caption}</p> : null}
    </CornerBracketPanel>
  );
}

export default function EarningsPage() {
  const payouts = usePayouts();
  const [filter, setFilter] = useState<StateFilter>("all");

  const summary = payouts.data?.summary;
  const rows = useMemo(() => {
    let list = payouts.data?.results ?? [];
    if (filter !== "all") list = list.filter((p) => p.state === filter);
    return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [payouts.data, filter]);

  return (
    <>
      <PageHeader title="Earnings" />

      {payouts.isPending ? (
        <div className="grid gap-s3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-s3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Earned this month"
              value={summary && summary.earned_this_month > 0 ? summary.earned_this_month_display : "—"}
              caption="from hires completed this month"
            />
            <Stat
              label="Last month"
              value={summary && summary.earned_prev_month > 0 ? summary.earned_prev_month_display : "—"}
            />
            <Stat
              label="Queued"
              value={summary && summary.queued_total > 0 ? summary.queued_total_display : "—"}
              caption="payouts run weekly"
            />
            <Stat
              label="On hold"
              value={summary && summary.frozen_total > 0 ? summary.frozen_total_display : "—"}
              caption={summary && summary.frozen_total > 0 ? "held while a dispute is open" : "nothing in dispute"}
            />
          </div>

          {summary?.last_paid ? (
            <p className="mt-s3 text-caption text-ink-500">
              Last payout <span className="font-mono">{summary.last_paid.amount_display}</span>
              {summary.last_paid.paid_ref ? (
                <>
                  {" "}
                  · ref <span className="font-mono">{summary.last_paid.paid_ref}</span>
                </>
              ) : null}
              {" · "}
              {new Date(summary.last_paid.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : null}

          <section className="mt-s6">
            <div className="mb-s3 flex flex-wrap items-center justify-between gap-s3">
              <h2 className="font-display text-h2 text-text-primary">Payouts</h2>
              <div className="flex gap-s1">
                {(["all", "pending", "due", "paid", "frozen"] as StateFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={cn(
                      "rounded-pill px-s3 py-s1 text-caption font-medium",
                      filter === f ? "bg-ink-900 text-paper-0" : "text-text-secondary hover:bg-ink-100",
                    )}
                  >
                    {f === "all" ? "All" : STATE_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <Card className="p-s6 text-center text-body-sm text-text-secondary">
                {filter === "all"
                  ? "No payouts yet — each completed hire queues one, and they run weekly."
                  : "Nothing in this state."}
              </Card>
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[40rem] border-collapse text-body-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-sunken text-left">
                      <th className="px-s4 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-600">Date</th>
                      <th className="px-s4 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-600">Hire</th>
                      <th className="px-s4 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-600">Kind</th>
                      <th className="px-s4 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-600">State</th>
                      <th className="px-s4 py-s2 text-right font-display text-overline uppercase tracking-[0.1em] text-ink-600">Amount</th>
                      <th className="px-s4 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-600">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p: Payout) => (
                      <tr key={p.id} className="border-b border-border-default last:border-0 hover:bg-ink-50">
                        <td className="whitespace-nowrap px-s4 py-s3 font-mono text-mono-sm text-text-secondary">
                          {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="max-w-56 px-s4 py-s3">
                          <Link href={`/hires/${p.hire_id}`} className="block truncate text-text-primary hover:underline">
                            {p.listing_title || "Hire"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-s4 py-s3 text-text-secondary">
                          {p.kind === "withheld_day" ? "Withheld day" : "Completion"}
                        </td>
                        <td className="whitespace-nowrap px-s4 py-s3">
                          <span className={cn("rounded-pill px-s2 py-s1 text-caption font-medium", STATE_PILL[p.state] ?? "bg-ink-100 text-text-secondary")}>
                            {STATE_LABEL[p.state] ?? p.state}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-s4 py-s3 text-right font-mono font-medium text-text-primary">
                          {p.amount_display}
                        </td>
                        <td className="whitespace-nowrap px-s4 py-s3 font-mono text-mono-sm text-ink-500">
                          {p.paid_ref || "—"}
                          {p.paid_at ? (
                            <span className="text-ink-400">
                              {" · "}
                              {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </>
      )}
    </>
  );
}
