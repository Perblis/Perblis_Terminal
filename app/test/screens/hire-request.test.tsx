// Wave-8 mandatory F3 branch coverage: 409 race sheet, Basic-cap gate,
// client-estimate labelling, and the server-figures-only hero (D-014).
import { fireEvent } from "@testing-library/react-native";

import HireRequest from "../../app/hire-request/[listingId]";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ listingId: "l1" }),
}));

const LISTING = {
  id: "l1",
  supplier_id: "s1",
  yard_id: "y1",
  asset_class: "plant_machinery",
  asset_type: "Excavator",
  title: "CAT 320D — 20t Excavator",
  description: "",
  specs: { operator_included: true },
  spec_template_version: 3,
  daily_price: 9000000,
  weekly_price: 45000000,
  monthly_price: null,
  daily_price_display: "₦90,000",
  weekly_price_display: "₦450,000",
  monthly_price_display: null,
  unit_count: 1,
  units: [],
  photos: [],
  point: { type: "Point", coordinates: [3.4, 6.45] },
  address_text: "",
  city: "Lagos",
  status: "live",
  tier: "verified",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

// Server 201: deliberately DIFFERENT from any client estimate so the hero
// test proves it renders the server string verbatim.
const HIRE_201 = {
  id: "h1",
  listing_id: "l1",
  listing_title: LISTING.title,
  asset_class: "plant_machinery",
  yard_id: "y1",
  listing_photo: "",
  start_date: "2026-08-10",
  end_date: "2026-08-23",
  duration_days: 14,
  scheme: "weekly",
  status: "requested",
  hire_value: 87700000,
  hire_value_display: "₦877,777", // sentinel — not reproducible client-side
  cancelled_by: null,
  decline_reason: "",
  cancel_reason: "",
  hirer_note: "",
  request_expires_at: "2026-08-08T12:00:00Z",
  payment_deadline: null,
  created_at: "2026-08-07T12:00:00Z",
  events: [],
  // fee-bearing siblings must never render even if a serializer regressed:
  service_fee: 13500000,
  service_fee_display: "₦135,000",
  payout_amount: 76500000,
  payout_amount_display: "₦765,000",
};

type PostBehaviour = "created" | "conflict" | "cap";
let postBehaviour: PostBehaviour = "created";

beforeEach(() => {
  postBehaviour = "created";
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/hires") && init?.method === "POST") {
      if (postBehaviour === "conflict") {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: { code: "availability_conflict", message: "Those dates were just taken." },
          }),
        } as unknown as Response;
      }
      if (postBehaviour === "cap") {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: "basic_cap_exceeded",
              message: "This hire exceeds the ₦250,000 cap for Basic accounts.",
            },
          }),
        } as unknown as Response;
      }
      return { ok: true, status: 201, json: async () => HIRE_201 } as unknown as Response;
    }
    if (u.includes("/availability")) {
      const availability = {
        listing_id: "l1",
        unit_count: 1,
        from: "2026-08-01",
        to: "2026-08-31",
        days: [], // no holds — every visible day stays pickable
      };
      return { ok: true, status: 200, json: async () => availability } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => LISTING } as unknown as Response;
  }) as unknown as typeof fetch;
});

async function driveToConfirm(screen: Awaited<ReturnType<typeof renderScreen>>) {
  // ① pick a 14-day range in a future month via the calendar day cells
  await screen.findByText("When do you need it?");
  const next = screen.getByLabelText("Next month");
  await fireEvent.press(next); // move past "today" constraints deterministically
  const days = screen.getAllByLabelText(/^\d{4}-\d{2}-10$/);
  await fireEvent.press(days[0]);
  const ends = screen.getAllByLabelText(/^\d{4}-\d{2}-23$/);
  await fireEvent.press(ends[0]);
  await fireEvent.press(screen.getByText("Next — review"));
  // ② review — acknowledgment required (plant + operator_included)
  await screen.findByText("Review your request");
  await fireEvent(screen.getByLabelText("Acknowledge operator responsibility"), "valueChange", true);
  await fireEvent.press(screen.getByText("Next — confirm"));
  // ③ confirm
  await screen.findByText("Send the request?");
  await fireEvent.press(screen.getByText("Send request"));
}

test("② labels the client figure as an estimate; duration line matches the mirror", async () => {
  const screen = await renderScreen(<HireRequest />);
  await screen.findByText("When do you need it?");
  const next = screen.getByLabelText("Next month");
  await fireEvent.press(next);
  await fireEvent.press(screen.getAllByLabelText(/-10$/)[0]);
  await fireEvent.press(screen.getAllByLabelText(/-23$/)[0]);
  expect(screen.getByText("14 days → 2 × weekly — best price ✓")).toBeTruthy();
  await fireEvent.press(screen.getByText("Next — review"));
  expect(await screen.findByText("Estimated total")).toBeTruthy();
  expect(screen.getByText("₦900,000")).toBeTruthy(); // 2 × ₦450,000 client estimate
});

test("submitted state renders the SERVER hire_value_display verbatim (never the estimate)", async () => {
  const screen = await renderScreen(<HireRequest />);
  await driveToConfirm(screen);
  expect(await screen.findByText("₦877,777")).toBeTruthy(); // server sentinel
  expect(screen.queryByText("₦900,000")).toBeNull(); // client estimate gone
  expect(screen.getByText(/Awaiting supplier/)).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never)); // fee siblings never render
});

test("409 availability_conflict → race sheet → reset to ① with dates cleared", async () => {
  postBehaviour = "conflict";
  const screen = await renderScreen(<HireRequest />);
  await driveToConfirm(screen);
  expect(await screen.findByText("Those dates were just taken")).toBeTruthy();
  await fireEvent.press(screen.getByText("Pick new dates"));
  expect(await screen.findByText("When do you need it?")).toBeTruthy();
  expect(screen.getByText(/Pick a start and end date/)).toBeTruthy(); // range cleared
});

test("basic_cap_exceeded → cap gate with verify + shorten paths", async () => {
  postBehaviour = "cap";
  const screen = await renderScreen(<HireRequest />);
  await driveToConfirm(screen);
  expect(await screen.findByText("This hire needs a verified account")).toBeTruthy();
  expect(screen.getByText(/₦250,000 cap/)).toBeTruthy();
  expect(screen.getByText("Verify my account")).toBeTruthy();
  await fireEvent.press(screen.getByText("Shorten the hire instead"));
  expect(await screen.findByText("When do you need it?")).toBeTruthy();
});
