// S5 mandate: the yard sheet renders ENTIRELY from the map payload — zero
// extra round-trips (TSD §3.7 embedded summaries). fetch throws to prove it.
//
// 2026-08-08: also pins the 3-stop revision — the header is the peek state and
// the only place a bay's identity is drawn (the pin stopped repeating it), and
// rows split "<asset> — <purpose>" onto two lines instead of truncating.
import { fireEvent } from "@testing-library/react-native";

import type { MapYard } from "../../lib/types";
import { renderScreen } from "../../test/render";
import { YardSheet } from "./yard-sheet";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const YARD: MapYard = {
  yard_id: "y1",
  name: "Apapa Yard",
  point: { type: "Point", coordinates: [3.36, 6.44] },
  supplier: { id: "s1", name: "Kano Heavy Co", logo: "", badge: "verified" },
  listing_count: 3,
  matching_count: 3,
  price_from: 18000000,
  price_from_display: "₦180,000",
  class_mix: ["plant_machinery", "trucks_haulage"],
  listings: [
    {
      id: "l1",
      title: "20t Excavator — bulk earthworks",
      asset_class: "plant_machinery",
      price_from: 25000000,
      price_from_display: "₦250,000",
      photo: "",
      available: true,
    },
    {
      id: "l2",
      title: "30t Excavator",
      asset_class: "plant_machinery",
      price_from: 40000000,
      price_from_display: "₦400,000",
      photo: "",
      available: false,
    },
    {
      id: "l3",
      title: "Tipper Truck",
      asset_class: "trucks_haulage",
      price_from: 18000000,
      price_from_display: "₦180,000",
      photo: "",
      available: true,
    },
  ],
};

beforeEach(() => {
  globalThis.fetch = jest.fn(() => {
    throw new Error("S5 must not fetch — it renders from the map payload");
  }) as unknown as typeof fetch;
});

test("renders rows, prices and availability with zero fetches", async () => {
  const { getByText, getAllByText } = await renderScreen(<YardSheet yard={YARD} onDismiss={() => {}} />);
  expect(getByText("Apapa Yard")).toBeTruthy();
  expect(getByText("₦400,000")).toBeTruthy();
  expect(getByText("View company profile →")).toBeTruthy();
  // One taxonomy layer: a row without a qualifier falls back to its class
  // caption. "Plant & Machinery" therefore appears twice — once as the filter
  // chip, once as the 30t Excavator's caption.
  expect(getAllByText("Plant & Machinery")).toHaveLength(2);
  expect(getAllByText("· Available now")).toHaveLength(2);
  expect(getByText("· Currently on hire")).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("the header carries the bay's identity — the pin no longer repeats it", async () => {
  const { getByText, getAllByText } = await renderScreen(
    <YardSheet yard={YARD} onDismiss={() => {}} />,
  );
  expect(getByText("Apapa Yard")).toBeTruthy();
  expect(getByText("Kano Heavy Co")).toBeTruthy();
  expect(getByText("3 assets ·")).toBeTruthy();
  expect(getByText("2 available")).toBeTruthy();
  // The header's from-price legitimately equals the cheapest row's price.
  expect(getAllByText("₦180,000")).toHaveLength(2);
  expect(getByText("From")).toBeTruthy();
});

test("rows split '<asset> — <purpose>' onto two lines instead of truncating", async () => {
  const { getByText, queryByText, getByLabelText } = await renderScreen(
    <YardSheet yard={YARD} onDismiss={() => {}} />,
  );
  expect(getByText("20t Excavator")).toBeTruthy();
  expect(getByText("Bulk earthworks")).toBeTruthy();
  // The one-line form is what used to truncate mid-word.
  expect(queryByText("20t Excavator — bulk earthworks")).toBeNull();
  // …but it survives whole for screen readers.
  expect(
    getByLabelText("20t Excavator — bulk earthworks, ₦250,000 a day, Available now"),
  ).toBeTruthy();
});

test("class chip filters the rows", async () => {
  const { getByText, getByTestId, queryByText } = await renderScreen(
    <YardSheet yard={YARD} onDismiss={() => {}} />,
  );
  await fireEvent.press(getByTestId("yard-class-chip-trucks_haulage"));
  expect(getByText("Tipper Truck")).toBeTruthy();
  expect(queryByText("20t Excavator")).toBeNull();
});

test("single-class yard hides the chip row (nothing to filter)", async () => {
  const singleClass: MapYard = {
    ...YARD,
    class_mix: ["plant_machinery"],
    listings: YARD.listings.filter((l) => l.asset_class === "plant_machinery"),
  };
  const { queryByTestId, getByText } = await renderScreen(
    <YardSheet yard={singleClass} onDismiss={() => {}} />,
  );
  expect(getByText("20t Excavator")).toBeTruthy();
  // No chip — the row captions already name the class.
  expect(queryByTestId("yard-class-chip-plant_machinery")).toBeNull();
});
