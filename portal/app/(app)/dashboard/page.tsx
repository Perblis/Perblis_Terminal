"use client";

// P2 · Dashboard. Contextual headline (never a greeting), 4-stat row with
// corner brackets (D-021), escalating Action-needed, payout strip (F11),
// day-grouped activity feed, and the 07 §4 onboarding checklist that owns the
// screen until it's done. Zero stats show an em-dash, never ₦0.
import { ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CornerBracketPanel } from "@/components/ui/corner-brackets";
import { Skeleton } from "@/components/ui/skeleton";
import { bff } from "@/lib/api";
import {
  useActivateSupplier,
  useHireEvents,
  useHireStats,
  useListings,
  useMe,
  usePayouts,
  useSupplierProfile,
  useYards,
} from "@/lib/queries";

// --- countdown (tiered ticking: static till <1h, live mm:ss under) ----------
function useCountdown(iso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const target = iso ? new Date(iso).getTime() : null;
  const msLeft = target ? target - now : null;
  const live = msLeft !== null && msLeft < 60 * 60 * 1000;
  useEffect(() => {
    if (!target) return;
    const interval = window.setInterval(() => setNow(Date.now()), live ? 1_000 : 60_000);
    return () => window.clearInterval(interval);
  }, [target, live]);
  if (msLeft === null) return null;
  if (msLeft <= 0) return { text: "expired", urgent: true, live: true };
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  const s = Math.floor((msLeft % 60_000) / 1_000);
  return {
    text: live ? `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${h}h ${m}m`,
    urgent: msLeft < 4 * 3_600_000,
    live,
  };
}

function StatCard({
  label,
  value,
  caption,
  mono = true,
  href,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  mono?: boolean;
  href: string;
  tone?: "amber";
}) {
  return (
    <Link href={href} className="block min-w-0">
      <CornerBracketPanel
        className={`h-full p-s4 transition-colors duration-quick ${
          tone === "amber" ? "bg-amber-50 hover:bg-amber-100" : "bg-surface-card hover:bg-ink-50"
        }`}
      >
        <p className="font-display text-overline uppercase tracking-[0.1em] text-ink-500">{label}</p>
        <p className={`mt-s2 truncate ${mono ? "font-mono text-display-xl font-medium" : "font-display text-display-xl"} text-text-primary`}>
          {value}
        </p>
        {caption ? <p className="mt-s1 truncate text-caption text-ink-500">{caption}</p> : null}
      </CornerBracketPanel>
    </Link>
  );
}

// --- onboarding checklist (07 §4) -------------------------------------------
function Checklist() {
  const me = useMe();
  const profile = useSupplierProfile(Boolean(me.data?.is_supplier));
  const yards = useYards();
  const listings = useListings();
  const activate = useActivateSupplier();
  const [collapsed, setCollapsed] = useState(false);

  if (!me.data) return null;

  if (!me.data.is_supplier) {
    return (
      <Card className="mb-s5 flex flex-col items-start gap-s3 p-s5">
        <h2 className="font-display text-h2 text-text-primary">Start supplying on Terminal</h2>
        <p className="max-w-lg text-body-sm text-text-secondary">
          Activate your supplier account to list assets, take hire requests, and get paid weekly.
          Takes one click — then the checklist walks you to your first Live listing.
        </p>
        <Button size="lg" loading={activate.isPending} onClick={() => activate.mutate()}>
          Become a supplier
        </Button>
      </Card>
    );
  }

  const items = [
    {
      label: "Business profile",
      done: Boolean(profile.data?.business_name),
      href: "/settings",
      cta: "Add your business name",
    },
    {
      label: "Bank details",
      done: Boolean(profile.data?.bank_account_number_masked),
      href: "/settings",
      cta: "Where payouts land",
    },
    { label: "First yard", done: (yards.data?.length ?? 0) > 0, href: "/assets?yards=1", cta: "Pin your depot" },
    {
      label: "First listing",
      done: (listings.data?.length ?? 0) > 0,
      href: "/assets/new",
      cta: "Six steps, ten minutes",
    },
    {
      label: "Verification",
      done: me.data.is_verified,
      href: "/assets/new",
      cta: "Unlocks publishing",
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;

  return (
    <Card className="mb-s5 p-s5">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="text-left">
          <h2 className="font-display text-h3 text-text-primary">Get set up</h2>
          <p className="text-caption text-ink-500">
            {doneCount} of {items.length} done — a complete setup is what turns visits into requests
          </p>
        </div>
        {collapsed ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
      </button>
      <div className="mt-s3 h-s1 overflow-hidden rounded-pill bg-ink-100">
        <div className="h-full bg-amber-500 transition-[width] duration-standard" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      {!collapsed ? (
        <ul className="mt-s4 flex flex-col gap-s2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-s3 rounded-sm border border-border-default px-s3 py-s2">
              <span
                className={`grid size-s5 shrink-0 place-items-center rounded-pill ${
                  item.done ? "bg-green-700 text-paper-0" : "border border-ink-300 text-transparent"
                }`}
                aria-hidden
              >
                <Check size={13} />
              </span>
              <span className={`flex-1 text-body-sm ${item.done ? "text-ink-500 line-through" : "font-medium text-text-primary"}`}>
                {item.label}
              </span>
              {!item.done ? (
                <Link href={item.href} className="flex items-center gap-s1 text-body-sm text-text-link underline">
                  {item.cta} <ArrowRight size={13} aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

// --- page ---------------------------------------------------------------------
export default function DashboardPage() {
  const me = useMe();
  const stats = useHireStats();
  const payouts = usePayouts();
  const events = useHireEvents();
  const listings = useListings();
  const unread = useQuery({
    queryKey: ["unread-total"],
    queryFn: () => bff<{ unread_total: number }>("/conversations"),
    refetchInterval: 60_000,
    select: (d) => d.unread_total ?? 0,
  });

  const countdown = useCountdown(stats.data?.nearest_request_expires_at);
  const needsResponse = stats.data?.needs_response ?? 0;
  const onHire = stats.data?.by_status?.on_hire ?? 0;
  const fleetSize = (listings.data ?? []).filter((l) => l.status !== "archived").length;
  const summary = payouts.data?.summary;

  const headline = useMemo(() => {
    if (!stats.data) return null;
    if (needsResponse > 0 && stats.data.nearest_request_expires_at) {
      const at = new Date(stats.data.nearest_request_expires_at);
      return `${needsResponse} request${needsResponse > 1 ? "s" : ""} need${needsResponse === 1 ? "s" : ""} a response by ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (onHire > 0) return `All quiet — ${onHire} asset${onHire > 1 ? "s" : ""} on hire`;
    return "All quiet";
  }, [stats.data, needsResponse, onHire]);

  const eventRows = events.data;
  const dayGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof eventRows>>();
    for (const event of (eventRows ?? []).slice(0, 10)) {
      const day = new Date(event.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(event);
    }
    return [...groups.entries()];
  }, [eventRows]);

  const isSupplier = me.data?.is_supplier ?? true;

  return (
    <>
      <PageHeader title={headline ?? "Dashboard"} />

      {/* Action-needed escalation: under ~4h the countdown rises to a banner */}
      {needsResponse > 0 && countdown?.urgent ? (
        <Banner
          tone="warning"
          className="mb-s4"
          action={
            <Link href="/hires" className="text-body-sm font-medium underline">
              Respond now
            </Link>
          }
        >
          Nearest request expires in <span className="font-mono font-medium">{countdown.text}</span> —
          expired requests count against your response record.
        </Banner>
      ) : null}

      <Checklist />

      {isSupplier ? (
        <>
          <div className="grid gap-s3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.isPending || payouts.isPending ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)
            ) : (
              <>
                <StatCard
                  label="Earned this month"
                  value={summary && summary.earned_this_month > 0 ? summary.earned_this_month_display : "—"}
                  caption={
                    summary && summary.earned_prev_month > 0
                      ? `last month ${summary.earned_prev_month_display}`
                      : "completed hires land here"
                  }
                  href="/hires"
                />
                <StatCard
                  label="On hire now"
                  value={onHire > 0 ? `${onHire}/${fleetSize || "—"}` : "—"}
                  caption={fleetSize > 0 ? `${fleetSize} listed asset${fleetSize > 1 ? "s" : ""}` : "list an asset to get started"}
                  href="/hires"
                />
                <StatCard
                  label="Action needed"
                  value={needsResponse > 0 ? String(needsResponse) : "—"}
                  caption={
                    needsResponse > 0 && countdown ? `nearest expires ${countdown.live ? "in " : ""}${countdown.text}` : "requests wait 24h for you"
                  }
                  href="/hires"
                  tone={needsResponse > 0 ? "amber" : undefined}
                />
                <StatCard
                  label="Unread messages"
                  value={(unread.data ?? 0) > 0 ? String(unread.data) : "—"}
                  caption="enquiries and hire chats"
                  href="/messages"
                />
              </>
            )}
          </div>

          {/* payout strip (F11) */}
          {summary ? (
            <Card className="mt-s4 flex flex-wrap items-center gap-s4 bg-surface-sunken p-s4">
              <p className="text-body-sm text-text-secondary">
                {summary.queued_total > 0 ? (
                  <>
                    <span className="font-mono font-medium text-text-primary">{summary.queued_total_display}</span> queued —
                    payouts run weekly
                  </>
                ) : (
                  "Nothing queued — payouts run weekly after each completed hire"
                )}
                {summary.frozen_total > 0 ? (
                  <span className="text-violet-900"> · {summary.frozen_total_display} on hold — dispute</span>
                ) : null}
              </p>
              {summary.last_paid ? (
                <p className="ml-auto text-caption text-ink-500">
                  last payout <span className="font-mono">{summary.last_paid.amount_display}</span>
                  {summary.last_paid.paid_ref ? <span className="font-mono"> · {summary.last_paid.paid_ref}</span> : null}
                </p>
              ) : null}
            </Card>
          ) : null}

          {/* activity feed */}
          <section className="mt-s6">
            <h2 className="mb-s3 font-display text-h2 text-text-primary">Activity</h2>
            {events.isPending ? (
              <Card className="flex flex-col gap-s3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-s6 w-full" />)}
              </Card>
            ) : dayGroups.length === 0 ? (
              <Card className="p-s5 text-center text-body-sm text-text-secondary">
                Activity appears here — requests, payments, handovers, the lot.
              </Card>
            ) : (
              <Card className="p-0">
                {dayGroups.map(([day, dayEvents]) => (
                  <div key={day}>
                    <p className="border-b border-border-default bg-surface-sunken px-s4 py-s1 font-display text-overline uppercase tracking-[0.1em] text-ink-600">
                      {day}
                    </p>
                    <ul>
                      {dayEvents.map((event) => (
                        <li key={event.id} className="border-b border-border-default last:border-0">
                          <Link href={`/hires/${event.hire_id}`} className="flex items-center gap-s3 px-s4 py-s3 hover:bg-ink-50">
                            <span className="size-s2 shrink-0 rounded-pill bg-amber-500" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-sm text-text-primary">
                                {event.listing_title ?? "Hire"} — {event.to_status.replace(/_/g, " ")}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-mono-sm text-ink-500">
                              {new Date(event.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
