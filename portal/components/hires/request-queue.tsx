"use client";

// P2 command-center queues: every pending request with inline accept/decline
// (the dashboard is where you WORK, not a report), and the handovers that
// need attention today. Both render nothing when empty.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { RespondDialog } from "@/components/hires/respond-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateRange } from "@/lib/hire-domain";
import { useHires } from "@/lib/queries";
import type { Hire } from "@/lib/types";

function useNow(liveSeconds: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), liveSeconds ? 1_000 : 60_000);
    return () => window.clearInterval(t);
  }, [liveSeconds]);
  return now;
}

function countdownText(iso: string | null, now: number): { text: string; urgent: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { text: "expired", urgent: true };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (ms < 3_600_000) return { text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, urgent: true };
  return { text: `${h}h ${m}m`, urgent: ms < 4 * 3_600_000 };
}

export function RequestQueue() {
  const hires = useHires();
  const requested = useMemo(
    () =>
      (hires.data ?? [])
        .filter((h) => h.status === "requested")
        .sort((a, b) => (a.request_expires_at ?? "").localeCompare(b.request_expires_at ?? "")),
    [hires.data],
  );
  const anyUnderHour = requested.some(
    (h) => h.request_expires_at && new Date(h.request_expires_at).getTime() - Date.now() < 3_600_000,
  );
  const now = useNow(anyUnderHour);
  const [dialog, setDialog] = useState<{ hire: Hire; mode: "accept" | "decline" } | null>(null);

  if (requested.length === 0) return null;

  return (
    <section className="mt-s5">
      <h2 className="mb-s3 font-display text-h2 text-text-primary">Needs your response</h2>
      <Card className="p-0">
        <ul>
          {requested.map((h) => {
            const cd = countdownText(h.request_expires_at, now);
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-s3 border-b border-border-default px-s4 py-s3 last:border-0"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <Link href={`/hires/${h.id}`} className="block truncate text-body-sm font-medium text-text-primary hover:underline">
                    {h.listing_title}
                  </Link>
                  <p className="font-mono text-mono-sm text-text-secondary">
                    {formatDateRange(h.start_date, h.end_date, h.duration_days)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-body-sm font-medium text-text-primary">{h.hire_value_display}</p>
                  {h.payout_amount_display ? (
                    <p className="font-mono text-mono-sm text-ink-500">{h.payout_amount_display} to you</p>
                  ) : null}
                </div>
                {cd ? (
                  <span
                    className={`shrink-0 rounded-pill px-s2 py-s1 font-mono text-mono-sm ${
                      cd.urgent ? "bg-amber-100 text-amber-900" : "bg-ink-100 text-text-secondary"
                    }`}
                  >
                    {cd.text}
                  </span>
                ) : null}
                <div className="flex shrink-0 gap-s2">
                  <Button size="sm" variant="secondary" onClick={() => setDialog({ hire: h, mode: "decline" })}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => setDialog({ hire: h, mode: "accept" })}>
                    Accept
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {dialog ? <RespondDialog hire={dialog.hire} mode={dialog.mode} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}

/** Local YYYY-MM-DD — hire dates are calendar dates, not instants. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HandoversDue() {
  const hires = useHires();
  const today = todayIso();
  const due = useMemo(() => {
    const rows: { hire: Hire; label: string; overdue: boolean }[] = [];
    for (const h of hires.data ?? []) {
      if (h.status === "confirmed" && h.start_date <= today) {
        rows.push({ hire: h, label: "On-hire handover due", overdue: h.start_date < today });
      } else if (h.status === "on_hire" && h.end_date <= today) {
        rows.push({ hire: h, label: "Off-hire return due", overdue: h.end_date < today });
      }
    }
    return rows;
  }, [hires.data, today]);

  if (due.length === 0) return null;

  return (
    <section className="mt-s5">
      <h2 className="mb-s3 font-display text-h2 text-text-primary">Handovers today</h2>
      <Card className="p-0">
        <ul>
          {due.map(({ hire, label, overdue }) => (
            <li key={hire.id} className="border-b border-border-default last:border-0">
              <Link href={`/hires/${hire.id}`} className="flex items-center gap-s3 px-s4 py-s3 hover:bg-ink-50">
                <span className={`size-s2 shrink-0 rounded-pill ${overdue ? "bg-red-600" : "bg-green-600"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-text-primary">{hire.listing_title}</span>
                  <span className="block font-mono text-mono-sm text-text-secondary">
                    {label}
                    {overdue ? " — overdue" : ""} · photos + reading make your dispute evidence
                  </span>
                </span>
                <span className="shrink-0 text-body-sm text-text-link underline">Record it</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
