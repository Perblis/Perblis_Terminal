// Client mirror of backend/hires/fees.py's BEST-PRICE selection (D-008,
// FSD §3.1) — hire_value + scheme ONLY. The fee/payout math is deliberately
// NOT ported: those figures are supplier-confidential (D-014) and must never
// exist in this codebase's render tree. This estimate powers S7's Review
// step and duration line; every HERO total renders the server's
// hire_value_display verbatim (see components/hires/price-hero).
import { formatNairaInput } from "./naira";
import type { Listing } from "./types";

export type Scheme = "daily" | "weekly" | "monthly";

const SCHEME_DAYS: Record<Scheme, number> = { daily: 1, weekly: 7, monthly: 30 };

export type PriceEstimate = {
  scheme: Scheme;
  units: number;
  days: number;
  /** kobo — a client ESTIMATE, never rendered as the hero figure. */
  totalKobo: number;
  /** "₦900,000" formatted for the estimate line. */
  totalDisplayEstimate: string;
  /** "14 days → 2 × weekly — best price ✓" (09 §2 voice). */
  durationLine: string;
  /** True when more than one scheme was priced (the ✓ is meaningful). */
  bestPrice: boolean;
};

/** Inclusive hire length: d = end − start + 1 (FSD §3.1). */
export function inclusiveDays(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  const d = Math.round((end - start) / 86_400_000) + 1;
  if (d < 1) throw new Error("end_date must be on or after start_date");
  return d;
}

const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

export function quoteEstimate(
  listing: Pick<Listing, "daily_price" | "weekly_price" | "monthly_price">,
  startIso: string,
  endIso: string,
): PriceEstimate {
  const days = inclusiveDays(startIso, endIso);
  const prices: Record<Scheme, number | null> = {
    daily: listing.daily_price,
    weekly: listing.weekly_price,
    monthly: listing.monthly_price,
  };

  const candidates: { total: number; scheme: Scheme; units: number }[] = [];
  for (const scheme of ["daily", "weekly", "monthly"] as Scheme[]) {
    const price = prices[scheme];
    if (price == null) continue;
    const units = ceilDiv(days, SCHEME_DAYS[scheme]);
    candidates.push({ total: price * units, scheme, units });
  }
  if (candidates.length === 0) throw new Error("at least one pricing scheme must be set");

  // Best price wins; ties resolve to the LONGER scheme (fees.py parity).
  candidates.sort((a, b) => a.total - b.total || SCHEME_DAYS[b.scheme] - SCHEME_DAYS[a.scheme]);
  const winner = candidates[0];

  const bestPrice = candidates.length > 1;
  const schemePart =
    winner.scheme === "daily"
      ? `${days} × daily`
      : `${winner.units} × ${winner.scheme}`;
  const durationLine = `${days} day${days === 1 ? "" : "s"} → ${schemePart}${bestPrice ? " — best price ✓" : ""}`;

  return {
    scheme: winner.scheme,
    units: winner.units,
    days,
    totalKobo: winner.total,
    totalDisplayEstimate: `₦${formatNairaInput(winner.total)}`,
    durationLine,
    bestPrice,
  };
}
