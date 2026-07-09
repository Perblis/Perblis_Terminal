// Pin state matrix per 06 §3: badge/dim/tick/count behaviours.
import { render } from "@testing-library/react-native";

import type { MapSoloListing, MapYard } from "../../lib/types";
import { AssetPin, ClusterPin, YardPin, availabilityCaption } from "./pins";

const SOLO: MapSoloListing = {
  id: "l1",
  title: "20t Excavator",
  asset_class: "plant_machinery",
  point: { type: "Point", coordinates: [3.4, 6.45] },
  price_from: 25000000,
  price_from_display: "₦250,000",
  distance_km: 2.1,
  photo: "",
  badge: "verified",
  available: true,
};

const YARD: MapYard = {
  yard_id: "y1",
  name: "Apapa Yard",
  point: { type: "Point", coordinates: [3.36, 6.44] },
  supplier: { id: "s1", name: "Kano Heavy Co", logo: "", badge: "verified" },
  listing_count: 8,
  matching_count: 3,
  class_mix: ["plant_machinery", "trucks_haulage", "warehousing", "land_staging"],
  price_from: 25000000,
  price_from_display: "₦250,000",
  listings: [],
};

test("asset pin carries the class + title accessibility label", async () => {
  const { getByLabelText } = await render(<AssetPin listing={SOLO} />);
  expect(getByLabelText("Plant & Machinery listing: 20t Excavator")).toBeTruthy();
});

test("yard pin shows listing_count unfiltered and matching_count filtered", async () => {
  const unfiltered = await render(<YardPin yard={YARD} />);
  expect(unfiltered.getByText("8")).toBeTruthy();
  const filtered = await render(<YardPin yard={YARD} filtered />);
  expect(filtered.getByText("3")).toBeTruthy();
});

test("zero-match yard dims to 40% but still renders (never removed)", async () => {
  const { getByLabelText } = await render(
    <YardPin yard={{ ...YARD, matching_count: 0 }} filtered />,
  );
  const pin = getByLabelText("Yard: Apapa Yard, 0 listings");
  expect(pin.props.style).toMatchObject({ opacity: 0.4 });
});

test("initials fall back when there is no logo; ≤3 class dots", async () => {
  const { getByText, getByLabelText } = await render(<YardPin yard={YARD} />);
  expect(getByText("KH")).toBeTruthy();
  // 4 classes in the mix — anatomy caps dots at 3 (asserted via children count)
  const pin = getByLabelText("Yard: Apapa Yard, 8 listings");
  const dotsRow = pin.children[pin.children.length - 1] as { children: unknown[] };
  expect(dotsRow.children).toHaveLength(3);
});

test("cluster is a drab mono count", async () => {
  const { getByText, getByLabelText } = await render(<ClusterPin count={12} />);
  expect(getByText("12")).toBeTruthy();
  expect(getByLabelText("12 listings — zoom in")).toBeTruthy();
});

test("availability caption vocabulary", () => {
  expect(availabilityCaption({ available: true })).toBe("Available now");
  expect(availabilityCaption({ available: false })).toBe("Currently on hire");
});
