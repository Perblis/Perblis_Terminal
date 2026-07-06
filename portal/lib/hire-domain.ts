// Pure hire-domain helpers. legalActions mirrors hires/state.py::TRANSITIONS
// EXACTLY — the UI can never offer an illegal transition (FSD §7.3); the
// table-driven vitest suite in hire-domain.test.ts is the wave-7 mandatory
// state-machine-fidelity check.
import type { HireStatus7 } from "./types";

export type SupplierAction =
  | "accept"
  | "decline"
  | "cancel"
  | "submit_handover" // on-hire capture happens in the field; portal offers confirm/submit
  | "confirm_handover"
  | "raise_issue";

/**
 * Supplier-legal actions per status (hires/state.py TRANSITIONS, supplier
 * actor): accept/decline from requested; cancel from requested/accepted/
 * confirmed; handover during confirmed (on-hire) and on_hire (off-hire);
 * dispute during on_hire or ≤72h after completion (server enforces the
 * window — the UI offers it on completed and lets the API refuse).
 */
export function legalSupplierActions(status: HireStatus7): SupplierAction[] {
  switch (status) {
    case "requested":
      return ["accept", "decline", "cancel"];
    case "accepted":
      return ["cancel"];
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

/** 09 §3 supplier status vocabulary — the only status language. */
export function supplierStatusCopy(status: HireStatus7, hoursToRespond?: number): string {
  switch (status) {
    case "requested":
      return `Action needed — respond${hoursToRespond !== undefined ? ` in ${hoursToRespond}h` : ""}`;
    case "accepted":
      return "Awaiting payment";
    case "confirmed":
      return "Confirmed — prepare for handover";
    case "on_hire":
      return "On hire";
    case "completed":
      return "Completed — payout queued";
    case "declined":
      return "You declined";
    case "expired":
      return "Expired — you missed this request";
    case "cancelled":
      return "Cancelled";
    case "in_dispute":
      return "In dispute — payout frozen";
  }
}

/** The P7 lifecycle rail: happy path + where a terminal state branches off. */
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

/** P6 tab membership. */
export const HIRE_TABS = {
  needs_response: ["requested"],
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
