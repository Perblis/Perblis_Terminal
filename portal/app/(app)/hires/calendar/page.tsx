"use client";

// P8 · CalendarGantt (06 §4) — custom CSS grid, NO calendar dependency
// (TSD §5). Read-only: availability is set by hires. Yard group headers,
// per-row utilisation, status-coloured blocks (dashed = tentative), today
// rule, weekend banding; click a block → P7.
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASS_BY_VALUE } from "@/lib/asset-classes";
import { useHires, useListings, useYards } from "@/lib/queries";
import type { Hire, HireStatus7 } from "@/lib/types";

const BLOCK_STYLE: Partial<Record<HireStatus7, string>> = {
  requested: "border border-dashed border-amber-600 bg-amber-50 text-amber-900",
  accepted: "border border-dashed border-blue-600 bg-blue-50 text-blue-900",
  confirmed: "bg-teal-50 text-teal-900 border border-teal-600",
  on_hire: "bg-green-600/25 text-green-900 border border-green-700",
  in_dispute: "bg-violet-50 text-violet-900 border border-violet-600",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  });
  const monthStart = anchor;
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const daysInMonth = monthEnd.getUTCDate();

  const hires = useHires({ from: iso(monthStart), to: iso(monthEnd) });
  const listings = useListings();
  const yards = useYards();

  const todayCol = useMemo(() => {
    const now = new Date();
    if (now.getUTCFullYear() === anchor.getUTCFullYear() && now.getUTCMonth() === anchor.getUTCMonth()) {
      return now.getUTCDate();
    }
    return null;
  }, [anchor]);

  const rows = useMemo(() => {
    const active = (listings.data ?? []).filter((l) => l.status === "live" || l.status === "paused");
    const byYard = new Map<string | null, typeof active>();
    for (const l of active) {
      const key = l.yard_id;
      if (!byYard.has(key)) byYard.set(key, []);
      byYard.get(key)!.push(l);
    }
    return [...byYard.entries()];
  }, [listings.data]);

  const hiresByListing = useMemo(() => {
    const map = new Map<string, Hire[]>();
    for (const h of hires.data ?? []) {
      if (!BLOCK_STYLE[h.status]) continue; // terminal states don't block dates
      if (!map.has(h.listing_id)) map.set(h.listing_id, []);
      map.get(h.listing_id)!.push(h);
    }
    return map;
  }, [hires.data]);

  function dayOf(dateIso: string, clampLow: boolean): number {
    const d = new Date(`${dateIso}T00:00:00Z`);
    if (d < monthStart) return clampLow ? 1 : 1;
    if (d > monthEnd) return daysInMonth;
    return d.getUTCDate();
  }

  function utilisation(listingId: string, unitCount: number): number {
    const busy = new Set<number>();
    for (const h of hiresByListing.get(listingId) ?? []) {
      if (h.status !== "confirmed" && h.status !== "on_hire") continue;
      for (let d = dayOf(h.start_date, true); d <= dayOf(h.end_date, false); d += 1) busy.add(d);
    }
    return Math.round((busy.size / daysInMonth) * 100 / Math.max(1, unitCount));
  }

  const yardName = (id: string | null) => (yards.data ?? []).find((y) => y.id === id)?.name ?? "No yard";
  const monthLabel = anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title="Calendar"
        action={
          <div className="flex items-center gap-s2">
            <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setAnchor(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1)))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-36 text-center font-display text-body font-medium">{monthLabel}</span>
            <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setAnchor(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />
      <p className="mb-s3 text-caption text-ink-500" title="Availability is set by hires">
        Read-only — availability is set by hires. Dashed blocks are tentative (awaiting response or payment).
      </p>

      {hires.isPending || listings.isPending ? (
        <Card className="flex flex-col gap-s3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-s6 w-full" />)}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-s6 text-center text-body-sm text-text-secondary">
          Publish a listing and its hires appear here as calendar blocks.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="min-w-[64rem]">
            {/* date header */}
            <div
              className="sticky top-0 grid border-b border-border-default bg-surface-page"
              style={{ gridTemplateColumns: `14rem repeat(${daysInMonth}, minmax(1.6rem, 1fr))` }}
            >
              <div className="px-s3 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-500">Asset</div>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const weekday = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), day)).getUTCDay();
                const weekend = weekday === 0 || weekday === 6;
                return (
                  <div
                    key={day}
                    className={`relative py-s2 text-center font-mono text-mono-sm ${weekend ? "bg-paper-100 text-ink-600" : "text-ink-500"} ${todayCol === day ? "font-medium text-amber-900" : ""}`}
                  >
                    {day}
                    {todayCol === day ? <span className="absolute inset-y-0 left-1/2 w-px bg-amber-500" aria-hidden /> : null}
                  </div>
                );
              })}
            </div>

            {rows.map(([yardId, yardListings]) => (
              <div key={yardId ?? "none"}>
                <div className="border-b border-border-default bg-surface-sunken px-s3 py-s1 font-display text-overline uppercase tracking-[0.1em] text-ink-600">
                  {yardName(yardId)}
                </div>
                {yardListings.map((listing) => {
                  const meta = CLASS_BY_VALUE[listing.asset_class];
                  const Glyph = CLASS_GLYPHS[listing.asset_class];
                  const util = utilisation(listing.id, 1);
                  return (
                    <div
                      key={listing.id}
                      className="relative grid h-10 border-b border-border-default last:border-0"
                      style={{ gridTemplateColumns: `14rem repeat(${daysInMonth}, minmax(1.6rem, 1fr))` }}
                    >
                      <div className={`flex items-center gap-s2 border-r px-s3 ${meta.text}`} style={{ borderRightColor: "var(--border-default)" }}>
                        <Glyph size={14} />
                        <span className="min-w-0 flex-1 truncate text-body-sm text-text-primary">{listing.title}</span>
                        <span className="flex items-center gap-s1">
                          <span className="h-s1 w-s5 overflow-hidden rounded-pill bg-ink-100" aria-hidden>
                            <span className="block h-full bg-green-600" style={{ width: `${Math.min(100, util)}%` }} />
                          </span>
                          <span className="font-mono text-mono-sm text-ink-500">{util}%</span>
                        </span>
                      </div>
                      {/* weekend banding under blocks */}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const weekday = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), i + 1)).getUTCDay();
                        return weekday === 0 || weekday === 6 ? (
                          <span key={i} className="bg-paper-100" style={{ gridColumn: `${i + 2} / ${i + 3}` }} aria-hidden />
                        ) : null;
                      })}
                      {todayCol ? (
                        <span className="pointer-events-none absolute inset-y-0 w-px bg-amber-500" style={{ left: `calc(14rem + (100% - 14rem) / ${daysInMonth} * ${todayCol - 0.5})` }} aria-hidden />
                      ) : null}
                      {(hiresByListing.get(listing.id) ?? []).map((h) => {
                        const startCol = dayOf(h.start_date, true) + 1;
                        const endCol = dayOf(h.end_date, false) + 2;
                        return (
                          <Link
                            key={h.id}
                            href={`/hires/${h.id}`}
                            title={`${h.listing_title} · ${h.status.replace(/_/g, " ")}`}
                            className={`z-10 my-s1 flex items-center overflow-hidden truncate rounded-sm px-s1 text-caption font-medium ${BLOCK_STYLE[h.status]}`}
                            style={{ gridColumn: `${startCol} / ${endCol}`, gridRow: 1 }}
                          >
                            {endCol - startCol > 2 ? h.status.replace(/_/g, " ") : ""}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {hires.isError ? <Banner tone="danger" className="mt-s3">Couldn&apos;t load hires for this month.</Banner> : null}
    </>
  );
}
