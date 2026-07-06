// Pure hire-domain helpers, hirer actor. legalHirerActions mirrors
// backend/hires/state.py::TRANSITIONS EXACTLY — the UI can never offer an
// illegal transition (FSD §7.3); the table-driven jest suite in
// hire-domain.test.ts is the wave-8 mandatory state-machine-fidelity check.
// LIFECYCLE/lifecycleIndex/HIRE_TABS/formatDateRange are copied from
// portal/lib/hire-domain.ts (Wave 7) — keep in sync by copy, not import.
import type { HireStatus7 } from "./types";

export type HirerAction =
  | "cancel" // requested/accepted/confirmed — §7.6 refund ladder applies
  | "pay" // accepted → opens the payment sheet (GET :id/payment)
  | "submit_handover" // camera-first capture, on-hire (confirmed) & off-hire (on_hire)
  | "confirm_handover"
  | "raise_issue"; // dispute — on_hire, or ≤72h after completion (server enforces the window)

/**
 * Hirer-legal actions per status (hires/state.py TRANSITIONS, hirer actor):
 * cancel from requested/accepted/confirmed; pay from accepted (the `pay`
 * transition itself fires from the payment webhook — the button opens the
 * checkout); handover capture during confirmed (on-hire) and on_hire
 * (off-hire); dispute during on_hire or ≤72h after completion (the UI
 * offers it on completed and lets the API refuse).
 */
export function legalHirerActions(status: HireStatus7): HirerAction[] {
  switch (status) {
    case "requested":
      return ["cancel"];
    case "accepted":
      return ["pay", "cancel"];
    case "confirmed":
      return ["cancel", "submit_handover", "confirm_handover"];
    case "on_hire":
      return ["submit_handover", "confirm_handover", "raise_issue"];
    case "completed":
      return ["raise_issue"];
    case "declined":
    case "expired":
    case "cancelled":
    case "in_dispute":
      return [];
  }
}

/** 09 §3 hirer status vocabulary — the only status language. D-014: no fee words ever. */
export function hirerStatusCopy(status: HireStatus7, hoursToPay?: number): string {
  switch (status) {
    case "requested":
      return "Awaiting supplier — they have 24h to respond";
    case "accepted":
      return `Accepted — pay${hoursToPay !== undefined ? ` within ${hoursToPay}h` : " now"} to confirm`;
    case "confirmed":
      return "Confirmed — prepare for handover";
    case "on_hire":
      return "On hire";
    case "completed":
      return "Completed";
    case "declined":
      return "Supplier declined";
    case "expired":
      return "Expired — the supplier didn't respond in time";
    case "cancelled":
      return "Cancelled";
    case "in_dispute":
      return "In dispute — we're on it";
  }
}

/** The S10 lifecycle rail: happy path + where a terminal state branches off. */
export const LIFECYCLE: HireStatus7[] = ["requested", "accepted", "confirmed", "on_hire", "completed"];

export function lifecycleIndex(status: HireStatus7): number {
  const i = LIFECYCLE.indexOf(status);
  if (i >= 0) return i;
  // Terminal branches attach after the state they exit from.
  switch (status) {
    case "declined":
    case "expired":
      return 0;
    case "cancelled":
      return 2; // can branch from requested/accepted/confirmed; render mid-rail
    case "in_dispute":
      return 3;
  }
  return 0;
}

/** S9 tab membership (Requested · Upcoming · On hire · History). */
export const HIRE_TABS = {
  requested: ["requested"],
  upcoming: ["accepted", "confirmed"],
  on_hire: ["on_hire"],
  history: ["completed", "declined", "expired", "cancelled", "in_dispute"],
} as const satisfies Record<string, readonly HireStatus7[]>;

/** 09 §2 date range: 12 Jun → 26 Jun · 14 days. */
export function formatDateRange(startIso: string, endIso: string, days: number): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(startIso)} → ${fmt(endIso)} · ${days} day${days === 1 ? "" : "s"}`;
}
