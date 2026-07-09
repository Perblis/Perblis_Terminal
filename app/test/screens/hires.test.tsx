// S9 My Hires — tab partition, J8 "Hire again" two-tap re-request, and the
// D-014 render-layer leak gate on fee-bearing fixtures.
import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import HiresTab from "../../app/(tabs)/hires";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

function hire(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    listing_id: `l-${id}`,
    listing_title: `Asset ${id}`,
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
    // fee-bearing siblings must never render (D-014):
    service_fee: 13500000,
    service_fee_display: "₦135,000",
    payout_amount: 76500000,
    payout_amount_display: "₦765,000",
    ...extra,
  };
}

const HIRES = [
  hire("req1", "requested"),
  hire("acc1", "accepted"),
  hire("onh1", "on_hire"),
  hire("done1", "completed"),
];

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/hires")) {
      return { ok: true, status: 200, json: async () => ({ next: null, results: HIRES }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("defaults to Requested and shows only that tab's hires", async () => {
  const screen = await renderScreen(<HiresTab />);
  expect(await screen.findByText("Asset req1")).toBeTruthy();
  expect(screen.queryByText("Asset onh1")).toBeNull(); // on_hire lives in another tab
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("On hire tab partitions to the on_hire hire", async () => {
  const screen = await renderScreen(<HiresTab />);
  await screen.findByText("Asset req1");
  await fireEvent.press(screen.getByText("On hire"));
  expect(await screen.findByText("Asset onh1")).toBeTruthy();
  expect(screen.queryByText("Asset req1")).toBeNull();
});

test("History shows 'Hire again' → routes to a new request in one tap (J8)", async () => {
  const screen = await renderScreen(<HiresTab />);
  await screen.findByText("Asset req1");
  await fireEvent.press(screen.getByText("History"));
  expect(await screen.findByText("Hire again")).toBeTruthy();
  await fireEvent.press(screen.getByText("Hire again"));
  expect(router.push).toHaveBeenCalledWith("/hire-request/l-done1");
});
