// D-014 leak gate over S6: a maximal listing fixture renders with zero fee
// vocabulary (the listing serializer carries none — belt and braces).
import { act, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import ListingDetail from "../../app/listing/[id]";
import type { Me } from "../../lib/types";
import { useSession } from "../../stores/session";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "l1" }),
}));

const LISTING = {
  id: "l1",
  supplier_id: "s1",
  yard_id: "y1",
  asset_class: "plant_machinery",
  asset_type: "Excavator",
  title: "CAT 320D — 20t Excavator",
  description: "Well-maintained tracked excavator with operator available.",
  specs: { operating_weight: 20, operator_included: true },
  spec_template_version: 3,
  daily_price: 9000000,
  weekly_price: 45000000,
  monthly_price: 150000000,
  daily_price_display: "₦90,000",
  weekly_price_display: "₦450,000",
  monthly_price_display: "₦1,500,000",
  unit_count: 2,
  units: [],
  photos: [],
  point: { type: "Point", coordinates: [3.4, 6.45] },
  address_text: "Apapa, Lagos",
  city: "Lagos",
  status: "live",
  tier: "verified",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const TEMPLATE = {
  asset_class: "plant_machinery",
  asset_type: "Excavator",
  version: 3,
  fields: {
    operating_weight: { kind: "number", unit: "t", required: true, filterable: true, display_name: "Operating weight" },
    operator_included: { kind: "boolean", required: false, filterable: false, display_name: "Operator included" },
  },
};

beforeEach(() => {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    const body = u.includes("/spec-templates") ? TEMPLATE : LISTING;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("S6 renders the showroom with no fee vocabulary (D-014)", async () => {
  const screen = await renderScreen(<ListingDetail />);
  await screen.findByText("CAT 320D — 20t Excavator");
  expect(screen.getByText("₦450,000")).toBeTruthy();
  expect(await screen.findByText("Operating weight")).toBeTruthy();
  expect(screen.getByText("20 t")).toBeTruthy();
  expect(screen.getByText("Request to hire")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("a signed-in hirer's Request to hire proceeds — no auth bounce", async () => {
  useSession.setState({ me: { id: "me1", full_name: "Ada Obi" } as Me, hydrated: true });
  const screen = await renderScreen(<ListingDetail />);
  await fireEvent.press(await screen.findByText("Request to hire"));
  expect(router.push).toHaveBeenCalledWith("/hire-request/l1");
  await act(async () => useSession.setState({ me: null }));
});

test("a guest's Request to hire routes to login with the intent parked", async () => {
  useSession.setState({ me: null, hydrated: true });
  const screen = await renderScreen(<ListingDetail />);
  await fireEvent.press(await screen.findByText("Request to hire"));
  expect(router.push).toHaveBeenCalledWith("/auth/login");
});
