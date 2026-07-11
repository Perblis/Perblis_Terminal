// Pin state matrix per 06 §3 anatomy under the D-023 plate revision and the
// 2026-07-11 glance revision: plates carry compact prices and real class
// glyphs; badge/dim/tick/count behaviours are unchanged; the frame is a
// fixed ink equipment tag.
import { render } from "@testing-library/react-native";
import { tokens } from "@terminal/tokens";

import { compactNaira } from "../../lib/naira";
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

test("compactNaira scales kobo to pin-legible strings", () => {
  expect(compactNaira(25_000_000)).toBe("₦250k");
  expect(compactNaira(180_000_000)).toBe("₦1.8m");
  expect(compactNaira(1_200_000_000)).toBe("₦12m");
  expect(compactNaira(50_000)).toBe("₦500");
});

test("asset plate carries class, title, price and availability in the label + the compact price", async () => {
  const { getByLabelText, getByText } = await render(<AssetPin listing={SOLO} />);
  expect(
    getByLabelText("Plant & Machinery listing: 20t Excavator, from ₦250,000 a day"),
  ).toBeTruthy();
  expect(getByText("₦250k")).toBeTruthy();
});

test("on-hire solo plate dims to 45% but still renders (never removed)", async () => {
  const { getByLabelText } = await render(<AssetPin listing={{ ...SOLO, available: false }} />);
  const pin = getByLabelText(
    "Plant & Machinery listing: 20t Excavator, from ₦250,000 a day, currently on hire",
  );
  expect(pin.props.style).toMatchObject({ opacity: 0.45 });
});

test("yard plate shows listing_count unfiltered and matching_count filtered", async () => {
  const unfiltered = await render(<YardPin yard={YARD} />);
  expect(unfiltered.getByText("8")).toBeTruthy();
  const filtered = await render(<YardPin yard={YARD} filtered />);
  expect(filtered.getByText("3")).toBeTruthy();
});

test("yard plate carries the amber from-price row", async () => {
  const { getByText } = await render(<YardPin yard={YARD} />);
  const price = getByText("from ₦250k");
  const styles = [price.props.style].flat(Infinity);
  const color = styles.find((s) => s && typeof s === "object" && "color" in s)?.color;
  expect(color).toBe(tokens.color.colorAmber500);
});

test("yard plate skips the price row when there is no from-price", async () => {
  const { queryByText } = await render(<YardPin yard={{ ...YARD, price_from: 0 }} />);
  expect(queryByText(/^from /)).toBeNull();
});

test("zero-match yard dims to 40% but still renders (never removed)", async () => {
  const { getByLabelText } = await render(
    <YardPin yard={{ ...YARD, matching_count: 0 }} filtered />,
  );
  const pin = getByLabelText("Yard: Apapa Yard, 0 listings, from ₦250,000 a day");
  expect(pin.props.style).toMatchObject({ opacity: 0.4 });
});

test("initials fall back when there is no logo; ≤3 class glyphs name the offer", async () => {
  const { getByText, getByTestId } = await render(<YardPin yard={YARD} />);
  expect(getByText("KH")).toBeTruthy();
  // 4 classes in the mix — anatomy caps the glyph strip at 3
  const glyphStrip = getByTestId("yard-class-glyphs");
  expect(glyphStrip.children).toHaveLength(3);
  expect(glyphStrip.props.accessibilityLabel).toBe(
    "Offers Plant & Machinery, Trucks & Haulage, Warehousing & Storage",
  );
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

test("yard initials are brand amber on the fixed ink plate (contrast holds in both themes)", async () => {
  const { getByText } = await render(<YardPin yard={YARD} />);
  const initials = getByText("KH");
  const styles = [initials.props.style].flat(Infinity);
  const color = styles.find((s) => s && typeof s === "object" && "color" in s)?.color;
  expect(color).toBe(tokens.color.colorAmber500);
});

test("selected plates switch to the amber frame (no ring, no motion)", async () => {
  const { getByLabelText } = await render(<AssetPin listing={SOLO} selected />);
  const pin = getByLabelText("Plant & Machinery listing: 20t Excavator, from ₦250,000 a day");
  expect(pin.props.style).toMatchObject({ borderColor: tokens.color.colorAmber500, borderWidth: 2 });
});
