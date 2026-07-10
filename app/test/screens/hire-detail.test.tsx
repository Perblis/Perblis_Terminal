// S10 mandatory: banner/action matrix across all 9 hire states — every legal
// action renders, no illegal one ever does — plus the D-014 render-layer leak
// gate on a fee-bearing fixture.
import HireDetail from "../../app/hires/[id]";
import { hirerStatusCopy } from "../../lib/hire-domain";
import type { HireStatus7 } from "../../lib/types";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "h1" }),
}));

let currentStatus: HireStatus7 = "requested";

function hireFixture(status: HireStatus7) {
  return {
    id: "h1-abcdef00",
    listing_id: "l1",
    listing_title: "CAT 320D — 20t Excavator",
    asset_class: "plant_machinery",
    yard_id: "y1",
    listing_photo: null,
    start_date: "2026-08-10",
    end_date: "2026-08-23",
    duration_days: 14,
    scheme: "weekly",
    status,
    hire_value: 87700000,
    hire_value_display: "₦877,000",
    cancelled_by: null,
    decline_reason: "",
    cancel_reason: "",
    hirer_note: "",
    request_expires_at: null,
    payment_deadline: null,
    created_at: "2026-08-07T12:00:00Z",
    events: [{ id: "e1", actor_kind: "user", from_status: null, to_status: "requested", meta: {}, created_at: "2026-08-07T12:00:00Z" }],
    // fee-bearing siblings that must never render (D-014):
    service_fee: 13500000,
    service_fee_display: "₦135,000",
    payout_amount: 76500000,
    payout_amount_display: "₦765,000",
  };
}

beforeEach(() => {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/handovers")) {
      return { ok: true, status: 200, json: async () => [] } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => hireFixture(currentStatus) } as unknown as Response;
  }) as unknown as typeof fetch;
});

const ALL_ACTION_LABELS = [
  "Pay now",
  "Submit on-hire handover",
  "Submit off-hire handover",
  "Cancel hire",
  "Raise an issue",
];

const MATRIX: Record<HireStatus7, string[]> = {
  requested: ["Cancel hire"],
  accepted: ["Pay now", "Cancel hire"],
  confirmed: ["Cancel hire", "Submit on-hire handover"],
  on_hire: ["Submit off-hire handover", "Raise an issue"],
  completed: ["Raise an issue"],
  declined: [],
  expired: [],
  cancelled: [],
  in_dispute: [],
};

test.each(Object.keys(MATRIX) as HireStatus7[])(
  "%s: correct banner + only the legal actions, no fee leak",
  async (status) => {
    currentStatus = status;
    const screen = await renderScreen(<HireDetail />);
    // Await the unique listing title so the hire has loaded.
    await screen.findByText("CAT 320D — 20t Excavator");
    // Banner copy (09 §3) present (may also match the StatusBadge label — ≥1).
    expect(screen.getAllByText(hirerStatusCopy(status)).length).toBeGreaterThan(0);
    // Legal actions present; illegal ones absent (state-machine fidelity).
    const legal = MATRIX[status];
    for (const label of ALL_ACTION_LABELS) {
      if (legal.includes(label)) {
        // getAllByText: some labels (e.g. "Pay now") also appear as a StatusBadge.
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      } else {
        expect(screen.queryByText(label)).toBeNull();
      }
    }
    expectNoFeeLeak(collectStrings(screen.toJSON() as never));
  },
);
