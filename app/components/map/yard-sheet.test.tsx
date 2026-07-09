// S5 mandate: the yard sheet renders ENTIRELY from the map payload — zero
// extra round-trips (TSD §3.7 embedded summaries). fetch throws to prove it.
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
  class_mix: ["plant_machinery", "trucks_haulage"],
  price_from: 25000000,
  price_from_display: "₦250,000",
  listings: [
    {
      id: "l1",
      title: "20t Excavator",
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

test("renders header, class groups, prices and availability with zero fetches", async () => {
  const { getByText } = await renderScreen(<YardSheet yard={YARD} onDismiss={() => {}} />);
  expect(getByText("Apapa Yard")).toBeTruthy();
  expect(getByText("Kano Heavy Co · 3 assets")).toBeTruthy();
  expect(getByText("PLANT & MACHINERY")).toBeTruthy();
  expect(getByText("TRUCKS & HAULAGE")).toBeTruthy();
  expect(getByText("₦400,000")).toBeTruthy();
  expect(getByText("Currently on hire")).toBeTruthy();
  expect(getByText("View company profile →")).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("class chip filters the rows", async () => {
  const { getByText, queryByText } = await renderScreen(
    <YardSheet yard={YARD} onDismiss={() => {}} />,
  );
  // Chip labels render with counts alongside; select Trucks & Haulage.
  const chip = getByText("Trucks & Haulage");
  await fireEvent.press(chip);
  expect(getByText("Tipper Truck")).toBeTruthy();
  expect(queryByText("20t Excavator")).toBeNull();
});
