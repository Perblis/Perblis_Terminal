// S12 Search & Results. This screen had ZERO coverage before the 2026-08-09
// hierarchy rework — the grouping toggle, chip clearing, filter panel, empty
// state and pagination were all unguarded. These tests pin the behaviour the
// rework had to preserve, plus the two bugs it fixed.
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import Search from "../../app/search";
import { useMapState } from "../../stores/map-state";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const ASSET_ROW = {
  id: "l1",
  title: "Transit Concrete Mixer 8 m³ — ready-mix delivery",
  asset_class: "plant_machinery",
  point: { type: "Point", coordinates: [3.4, 6.45] },
  price_from: 16500000,
  price_from_display: "₦165,000",
  distance_km: 4.2,
  photo: "",
  badge: "verified",
  available: true,
  yard_id: "y1",
  more_at_yard: 3,
};

const YARD_ROW = {
  type: "yard",
  yard_id: "y1",
  name: "Ojota Plant Bay",
  point: { type: "Point", coordinates: [3.38, 6.58] },
  supplier: { id: "s1", name: "Cornerstone Plant Hire", logo: "", badge: "verified" },
  listing_count: 5,
  matching_count: null,
  class_mix: ["plant_machinery"],
  price_from: 6800000,
  price_from_display: "₦68,000",
  distance_km: 7.1,
  listings: [
    { id: "l1", title: "A", asset_class: "plant_machinery", price_from: 1, price_from_display: "₦1", photo: "", available: true },
    { id: "l2", title: "B", asset_class: "plant_machinery", price_from: 2, price_from_display: "₦2", photo: "", available: false },
  ],
};

/** Captures every /search/list URL the screen requests. */
let requested: string[] = [];

function mockList(rows: unknown[], { fail = false }: { fail?: boolean } = {}) {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    requested.push(String(url));
    if (fail) throw new Error("network down");
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: rows, next: null, previous: null }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  requested = [];
  // Bare, NOT wrapped in act(): calling act() before the first render of a
  // test leaves React in a state where the subsequent render produces nothing.
  useMapState.setState({ q: "", classFilter: null, dateRange: null });
  mockList([ASSET_ROW]);
});

test("renders asset rows with type, availability, distance and price on their own lines", async () => {
  const screen = await renderScreen(<Search />);
  // Title splits: asset name is the heading, purpose is the caption.
  expect(await screen.findByText("Transit Concrete Mixer 8 m³")).toBeTruthy();
  expect(screen.getByText("Ready-mix delivery")).toBeTruthy();
  expect(screen.getByText("Available now")).toBeTruthy();
  expect(screen.getByText("₦165,000")).toBeTruthy();
  expect(screen.getByText("+3 more at this yard")).toBeTruthy();
});

test("the summary discloses count AND ordering, and is honest about paging", async () => {
  const screen = await renderScreen(<Search />);
  // No `count` on the keyset contract, so it reports what is loaded.
  expect(await screen.findByText("1 asset · nearest first")).toBeTruthy();
});

test("Assets/Yards switches group_by in the request, not just the label", async () => {
  const screen = await renderScreen(<Search />);
  await screen.findByText("Transit Concrete Mixer 8 m³");
  expect(requested.some((u) => u.includes("group_by=asset"))).toBe(true);

  mockList([YARD_ROW]);
  await act(async () => {
    fireEvent.press(screen.getByTestId("group-by-location"));
  });
  await waitFor(() => expect(requested.some((u) => u.includes("group_by=location"))).toBe(true));
  expect(await screen.findByText("Ojota Plant Bay")).toBeTruthy();
  // Yard rows carry the company and availability, not just a count.
  expect(screen.getByText("Cornerstone Plant Hire")).toBeTruthy();
  expect(screen.getByText("1 available")).toBeTruthy();
});

test("the Map segment returns to the map rather than navigating somewhere new", async () => {
  const screen = await renderScreen(<Search />);
  await screen.findByText("Transit Concrete Mixer 8 m³");
  await act(async () => {
    fireEvent.press(screen.getByTestId("view-mode-map"));
  });
  expect(router.back).toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

test("advanced filters live in a sheet, not a permanently expanded panel", async () => {
  const screen = await renderScreen(<Search />);
  await screen.findByText("Transit Concrete Mixer 8 m³");
  // Nothing from the sheet is on screen until it is opened.
  expect(screen.queryByText("Price per day")).toBeNull();
  expect(screen.queryByText("Hire window")).toBeNull();

  await act(async () => {
    fireEvent.press(screen.getByTestId("open-filters"));
  });
  expect(screen.getByText("Price per day")).toBeTruthy();
  expect(screen.getByText("Distance")).toBeTruthy();
  // "Hire window", not "Availability" — dates never filter rows out.
  expect(screen.getByText("Hire window")).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText("Show results"));
  });
  await waitFor(() => expect(screen.queryByText("Price per day")).toBeNull());
});

test("the ★ spec filter names the class's real field instead of '★ spec'", async () => {
  useMapState.setState({ classFilter: "plant_machinery" });
  const screen = await renderScreen(<Search />);
  await act(async () => {
    fireEvent.press(screen.getByTestId("open-filters"));
  });
  expect(screen.getByText("Operating weight (tonnes)")).toBeTruthy();
  expect(screen.queryByText("★ spec min")).toBeNull();
});

test("an applied filter shows a clearable chip and a count on the Filters control", async () => {
  useMapState.setState({ classFilter: "plant_machinery", q: "mixer" });
  const screen = await renderScreen(<Search />);
  await screen.findByText("Transit Concrete Mixer 8 m³");

  expect(screen.getByLabelText("Filters, 2 active")).toBeTruthy();
  // Clear all appears at >=2 filters (07 §8).
  expect(screen.getByText("Clear all")).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByTestId("chip-class"));
  });
  expect(useMapState.getState().classFilter).toBeNull();
});

test("a failed request shows an error with retry — NOT 'no matches'", async () => {
  // Regression: search.isError was never read, so a network failure rendered
  // "No matches for '{q}' — widen the radius or clear a filter", telling the
  // user their search was too narrow when the request had actually failed.
  useMapState.setState({ q: "excavator" });
  mockList([], { fail: true });
  const screen = await renderScreen(<Search />);

  expect(await screen.findByText("Couldn’t load results")).toBeTruthy();
  expect(screen.getByText("Try again")).toBeTruthy();
  expect(screen.queryByText("No matches for “excavator”")).toBeNull();
});

test("a genuinely empty result set still says no matches", async () => {
  useMapState.setState({ q: "unobtainium" });
  mockList([]);
  const screen = await renderScreen(<Search />);
  expect(await screen.findByText("No matches for “unobtainium”")).toBeTruthy();
});

test("tapping a row opens the listing", async () => {
  const screen = await renderScreen(<Search />);
  await act(async () => {
    fireEvent.press(await screen.findByText("Transit Concrete Mixer 8 m³"));
  });
  expect(router.push).toHaveBeenCalledWith("/listing/l1");
});
