// Wave-7 mandatory: LockedTerms renders ONLY server figures — no client
// recomputation. We hand it deliberately inconsistent display strings; if any
// arithmetic happened, the rendered values couldn't all appear verbatim.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Hire } from "@/lib/types";

import { LockedTerms } from "./locked-terms";

const hire = {
  id: "h1",
  status: "confirmed",
  hire_value: 90_000_000,
  hire_value_display: "₦900,000",
  // Deliberately NOT hire_value − payout: proves no recomputation.
  service_fee_display: "₦123,456",
  payout_amount: 81_000_000,
  payout_amount_display: "₦810,000",
  fee_basis: "10% weekly · min ₦2,500",
} as unknown as Hire;

describe("LockedTerms (supplier variant, D-014 home)", () => {
  it("renders the server display strings verbatim", () => {
    render(<LockedTerms hire={hire} lockedAt="2026-06-12T14:32:00Z" />);
    expect(screen.getAllByText("₦810,000").length).toBeGreaterThanOrEqual(2); // hero + total row
    expect(screen.getByText("₦900,000")).toBeInTheDocument();
    expect(screen.getByText("−₦123,456")).toBeInTheDocument();
    expect(screen.getByText(/10% weekly/)).toBeInTheDocument();
    expect(screen.getByText(/Terms locked/)).toBeInTheDocument();
  });

  it("degrades to em-dash when fee fields are absent (hirer-shaped data must never render figures)", () => {
    const stripped = { ...hire, service_fee_display: undefined, payout_amount_display: undefined } as Hire;
    render(<LockedTerms hire={stripped} />);
    expect(screen.queryByText("₦810,000")).not.toBeInTheDocument();
  });
});
