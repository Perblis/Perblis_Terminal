// Wave-8 mandatory: state-machine fidelity — for each of the 9 hire states
// the S10 action set offers exactly the legal hirer actions (table-driven),
// mirroring backend/hires/state.py::TRANSITIONS for the hirer actor.
import {
  HIRE_TABS,
  formatDateRange,
  hirerStatusCopy,
  legalHirerActions,
  lifecycleIndex,
} from "./hire-domain";
import type { HireStatus7 } from "./types";

const TABLE: Record<HireStatus7, string[]> = {
  requested: ["cancel"],
  accepted: ["pay", "cancel"],
  confirmed: ["cancel", "submit_handover", "confirm_handover"],
  on_hire: ["submit_handover", "confirm_handover", "raise_issue"],
  completed: ["raise_issue"],
  declined: [],
  expired: [],
  cancelled: [],
  in_dispute: [],
};

const ALL_STATUSES = Object.keys(TABLE) as HireStatus7[];

describe("legalHirerActions mirrors hires/state.py TRANSITIONS (hirer actor)", () => {
  it.each(Object.entries(TABLE) as [HireStatus7, string[]][])("%s → %j", (status, expected) => {
    expect(legalHirerActions(status)).toEqual(expected);
  });

  it("never offers pay outside accepted (the webhook drives the pay transition)", () => {
    for (const status of ALL_STATUSES) {
      if (status === "accepted") continue;
      expect(legalHirerActions(status)).not.toContain("pay");
    }
  });

  it("never offers cancel once the hire has started or ended", () => {
    for (const status of ["on_hire", "completed", "declined", "expired", "cancelled", "in_dispute"] as HireStatus7[]) {
      expect(legalHirerActions(status)).not.toContain("cancel");
    }
  });

  it("never offers supplier verbs", () => {
    for (const status of ALL_STATUSES) {
      const actions = legalHirerActions(status) as string[];
      expect(actions).not.toContain("accept");
      expect(actions).not.toContain("decline");
    }
  });
});

describe("hirerStatusCopy (09 §3)", () => {
  it("covers all 9 states with non-empty copy", () => {
    for (const status of ALL_STATUSES) {
      expect(hirerStatusCopy(status).length).toBeGreaterThan(0);
    }
  });

  it("D-014: no fee/payout words in any status copy", () => {
    for (const status of ALL_STATUSES) {
      expect(hirerStatusCopy(status)).not.toMatch(/service[_ ]?fee|payout|commission/i);
    }
  });
});

describe("S9 tabs partition the 9 states exactly once", () => {
  it("is a partition", () => {
    const all = Object.values(HIRE_TABS).flat();
    expect([...all].sort()).toEqual([...ALL_STATUSES].sort());
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("lifecycle rail placement", () => {
  it("orders the happy path", () => {
    expect(
      (["requested", "accepted", "confirmed", "on_hire", "completed"] as HireStatus7[]).map(lifecycleIndex),
    ).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("formatDateRange (09 §2)", () => {
  it("renders arrow + duration", () => {
    expect(formatDateRange("2026-06-12", "2026-06-26", 14)).toBe("12 Jun → 26 Jun · 14 days");
  });
});
