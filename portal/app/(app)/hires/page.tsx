"use client";

// P6 · Hires. Tabs Needs response / Upcoming / On hire / History; expiry
// countdown column on the amber tab; hire value + YOUR PAYOUT mono (D-014
// supplier surface). Deliberately NO bulk actions — decisions are individual.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { BreakdownIllustration } from "@/components/ui/system-illustrations";
import { CLASS_BY_VALUE } from "@/lib/asset-classes";
import { formatDateRange, HIRE_TABS } from "@/lib/hire-domain";
import { useHires, useListings, useYards } from "@/lib/queries";
import type { Hire } from "@/lib/types";

type TabKey = keyof typeof HIRE_TABS;
const TAB_LABELS: Record<TabKey, string> = {
  needs_response: "Needs response",
  upcoming: "Upcoming",
  on_hire: "On hire",
  history: "History",
};

function ExpiryCell({ iso }: { iso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, []);
  if (!iso) return <span className="text-ink-400">—</span>;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return <span className="font-mono text-mono-sm text-ink-500">expired</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return (
    <span className={`font-mono text-mono-sm ${ms < 30 * 60_000 ? "text-red-700" : "text-blue-700"}`}>
      {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export default function HiresPage() {
  const hires = useHires();
  const yards = useYards();
  const listings = useListings();
  const [tab, setTab] = useState<TabKey>("needs_response");
  const [listingFilter, setListingFilter] = useState("");
  const [yardFilter, setYardFilter] = useState("");

  const counts = useMemo(() => {
    const map = {} as Record<TabKey, number>;
    for (const key of Object.keys(HIRE_TABS) as TabKey[]) {
      map[key] = (hires.data ?? []).filter((h) => (HIRE_TABS[key] as readonly string[]).includes(h.status)).length;
    }
    return map;
  }, [hires.data]);

  // Land on the busiest sensible tab once data arrives.
  useEffect(() => {
    if (hires.data && counts.needs_response === 0 && tab === "needs_response") {
      setTab(counts.on_hire > 0 ? "on_hire" : counts.upcoming > 0 ? "upcoming" : "history");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hires.data === undefined]);

  const rows = useMemo(() => {
    let list = (hires.data ?? []).filter((h) => (HIRE_TABS[tab] as readonly string[]).includes(h.status));
    if (listingFilter) list = list.filter((h) => h.listing_id === listingFilter);
    if (yardFilter) list = list.filter((h) => h.yard_id === yardFilter);
    if (tab === "needs_response") {
      list = [...list].sort(
        (a, b) => new Date(a.request_expires_at ?? 0).getTime() - new Date(b.request_expires_at ?? 0).getTime(),
      );
    }
    return list;
  }, [hires.data, tab, listingFilter, yardFilter]);

  const yardName = (id: string | null) => (yards.data ?? []).find((y) => y.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title="Hires" />

      <div className="mb-s4 flex flex-wrap items-center gap-s3 border-b border-border-default">
        {(Object.keys(HIRE_TABS) as TabKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-selected={tab === key}
            role="tab"
            className={`-mb-px flex items-center gap-s2 border-b-2 px-s2 pb-s2 text-body-sm font-medium ${
              tab === key
                ? "border-border-structural text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {TAB_LABELS[key]}
            {counts[key] > 0 ? (
              <span
                className={`rounded-pill px-s2 text-caption ${
                  key === "needs_response" ? "bg-amber-100 text-amber-900" : "bg-ink-100 text-ink-600"
                }`}
              >
                {counts[key]}
              </span>
            ) : null}
          </button>
        ))}
        <div className="ml-auto flex gap-s2 pb-s2">
          <select value={listingFilter} onChange={(e) => setListingFilter(e.target.value)} aria-label="Filter by listing" className="h-8 max-w-44 rounded-sm border border-border-default bg-surface-card px-s2 text-body-sm">
            <option value="">All listings</option>
            {(listings.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <select value={yardFilter} onChange={(e) => setYardFilter(e.target.value)} aria-label="Filter by yard" className="h-8 max-w-36 rounded-sm border border-border-default bg-surface-card px-s2 text-body-sm">
            <option value="">All yards</option>
            {(yards.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      </div>

      {hires.isPending ? (
        <Card className="flex flex-col gap-s3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[var(--density-row-height)] w-full" />)}
        </Card>
      ) : hires.isError ? (
        <Banner tone="danger">Couldn&apos;t load your hires. Refresh to try again.</Banner>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-s3 p-s7 text-center">
          <BreakdownIllustration />
          <p className="font-display text-h3 text-text-primary">
            {tab === "needs_response" ? "Nothing needs a response" : "Nothing here yet"}
          </p>
          <p className="max-w-sm text-body-sm text-text-secondary">
            {tab === "needs_response"
              ? "New requests appear here with a 24-hour countdown — you'll also get an email."
              : "Hires appear as hirers request your assets from the map."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] border-collapse text-body-sm">
            <thead>
              <tr>
                {["Asset", "Dates", tab === "needs_response" ? "Respond in" : "Status", "Hire value", "Your payout"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`border-b border-border-default px-s3 py-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-500 ${i >= 3 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((hire: Hire) => {
                const meta = CLASS_BY_VALUE[hire.asset_class];
                const Glyph = CLASS_GLYPHS[hire.asset_class];
                return (
                  <tr key={hire.id} className="h-[var(--density-row-height)] border-b border-border-default last:border-0 hover:bg-ink-50">
                    <td className="px-s3 py-[var(--density-cell-pad)]">
                      <Link href={`/hires/${hire.id}`} className="flex items-center gap-s3 hover:underline">
                        {hire.listing_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic
                          <img src={hire.listing_photo} alt="" className="size-s7 rounded-sm object-cover" />
                        ) : (
                          <span className={`grid size-s7 shrink-0 place-items-center rounded-sm ${meta.bg} ${meta.text}`}>
                            <Glyph size={18} />
                          </span>
                        )}
                        <span>
                          <span className="block max-w-[24ch] truncate font-medium text-text-primary">{hire.listing_title}</span>
                          <span className="block text-caption text-ink-500">{yardName(hire.yard_id)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-s3 font-mono text-mono-sm text-text-secondary">
                      {formatDateRange(hire.start_date, hire.end_date, hire.duration_days)}
                    </td>
                    <td className="px-s3">
                      {tab === "needs_response" ? (
                        <ExpiryCell iso={hire.request_expires_at} />
                      ) : (
                        <StatusBadge status={hire.status} />
                      )}
                    </td>
                    <td className="px-s3 text-right font-mono">{hire.hire_value_display}</td>
                    <td className="px-s3 text-right font-mono font-medium">{hire.payout_amount_display ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
