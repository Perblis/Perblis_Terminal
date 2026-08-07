// S11 Handover Capture — class-recipe reading, capture → submit → the record
// drains through the offline queue (POST), and the D-014 leak gate.
import { fireEvent } from "@testing-library/react-native";

import HandoverCapture from "../../app/handover/[hireId]";
import { useHandoverQueue } from "../../stores/handover-queue";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

let assetClass = "plant_machinery";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ hireId: "h1", kind: "on_hire" }),
}));

function hireFixture() {
  return {
    id: "h1",
    listing_id: "l1",
    listing_title: "CAT 320D — 20t Excavator",
    asset_class: assetClass,
    yard_id: "y1",
    listing_photo: null,
    start_date: "2026-08-10",
    end_date: "2026-08-23",
    duration_days: 14,
    scheme: "weekly",
    status: "confirmed",
    hire_value: 87700000,
    hire_value_display: "₦877,000",
    cancelled_by: null,
    decline_reason: "",
    cancel_reason: "",
    hirer_note: "",
    request_expires_at: null,
    payment_deadline: null,
    created_at: "2026-08-07T12:00:00Z",
    events: [],
    service_fee: 13500000,
    service_fee_display: "₦135,000",
    payout_amount: 76500000,
    payout_amount_display: "₦765,000",
  };
}

let handoverPosts = 0;

beforeEach(() => {
  assetClass = "plant_machinery";
  handoverPosts = 0;
  useHandoverQueue.setState({ items: [] });
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/media/presign")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ key: "handovers/x.jpg", bucket: "public", presigned_put_url: "https://r2/put", expires_in: 900 }),
      } as unknown as Response;
    }
    if (u.includes("/handovers") && init?.method === "POST") {
      handoverPosts += 1;
      return { ok: true, status: 201, json: async () => ({ id: "ho1" }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => hireFixture() } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("plant hire asks for an hour-meter reading; no fee leak", async () => {
  const screen = await renderScreen(<HandoverCapture />);
  expect(await screen.findByText("On-hire handover")).toBeTruthy();
  expect(screen.getByText("Hour meter reading")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("warehousing hire has no meter reading — condition notes instead", async () => {
  assetClass = "warehousing";
  const screen = await renderScreen(<HandoverCapture />);
  await screen.findByText("On-hire handover");
  expect(screen.queryByText("Hour meter reading")).toBeNull();
  expect(screen.getByText("Condition / occupancy notes")).toBeTruthy();
});

test("capture two photos → submit → the record drains (POST) → confirmation", async () => {
  const screen = await renderScreen(<HandoverCapture />);
  await screen.findByText("On-hire handover");
  await fireEvent.press(screen.getByText("Take photo"));
  await fireEvent.press(screen.getByText("Take photo"));
  await fireEvent.press(screen.getByText("Submit handover"));
  expect(await screen.findByText("Handover submitted")).toBeTruthy();
  expect(handoverPosts).toBe(1);
  expect(useHandoverQueue.getState().items).toHaveLength(0); // drained on success
});
