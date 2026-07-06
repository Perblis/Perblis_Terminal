// Wave-7 mandatory: state-machine fidelity — for each of the 9 hire states
// the action bar offers exactly the legal supplier actions (table-driven).
import { describe, expect, it } from "vitest";

import { legalSupplierActions, lifecycleIndex, formatDateRange } from "./hire-domain";
import type { HireStatus7 } from "./types";

const TABLE: Record<HireStatus7, string[]> = {
  requested: ["accept", "decline", "cancel"],
  accepted: ["cancel"],
  confirmed: ["cancel", "submit_handover", "confirm_handover"],
  on_hire: ["submit_handover", "confirm_handover", "raise_issue"],
  completed: ["raise_issue"],
  declined: [],
  expired: [],
  cancelled: [],
  in_dispute: [],
};

describe("legalSupplierActions mirrors hires/state.py TRANSITIONS", () => {
  it.each(Object.entries(TABLE) as [HireStatus7, string[]][])("%s → %j", (status, expected) => {
    expect(legalSupplierActions(status)).toEqual(expected);
  });

  it("never offers accept/decline outside requested", () => {
    for (const status of Object.keys(TABLE) as HireStatus7[]) {
      if (status === "requested") continue;
      const actions = legalSupplierActions(status);
      expect(actions).not.toContain("accept");
      expect(actions).not.toContain("decline");
    }
  });

  it("never offers cancel after payment-window states end", () => {
    for (const status of ["on_hire", "completed", "declined", "expired", "cancelled", "in_dispute"] as HireStatus7[]) {
      expect(legalSupplierActions(status)).not.toContain("cancel");
    }
  });
});

describe("lifecycle rail placement", () => {
  it("orders the happy path", () => {
    expect(["requested", "accepted", "confirmed", "on_hire", "completed"].map((s) => lifecycleIndex(s as HireStatus7))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("formatDateRange (09 §2)", () => {
  it("renders arrow + duration", () => {
    expect(formatDateRange("2026-06-12", "2026-06-26", 14)).toBe("12 Jun → 26 Jun · 14 days");
  });
});
