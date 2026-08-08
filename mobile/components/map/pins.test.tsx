// Pin state matrix per 06 §3 anatomy under the D-023 plate revision, the
// 2026-07-11 glance revision, the 2026-07-13 price-first revision, and the
// 2026-08-08 discovery-layer revision: ONE plate anatomy — `price │ count` —
// selected or not, because the old detailed plate only ever rendered on the
// selected pin and duplicated the sheet beneath it. Selection is the frame
// alone (brand border + lift, no size change). Identity moved to the sheet;
// the accessibility label still carries it. Brand = primary.500 (D-028), not
// amber — amber is the warning hue.
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

function styleOf(node: { props: { style?: unknown } }) {
  return [node.props.style].flat(Infinity).find((s) => s && typeof s === "object") as
    | Record<string, unknown>
    | undefined;
}

function colorOf(node: { props: { style?: unknown } }) {
  const styles = [node.props.style].flat(Infinity) as (Record<string, unknown> | null)[];
  return styles.find((s) => s && typeof s === "object" && "color" in s)?.color;
}

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

test("yard plate is price │ count — price leads, count is the secondary datum", async () => {
  const { getByText } = await render(<YardPin yard={YARD} />);
  const price = getByText(compactNaira(YARD.price_from));
  const count = getByText("8");
  expect(colorOf(price)).toBe(tokens.color.colorPaper0);
  expect(colorOf(count)).toBe(tokens.color.colorInk300);
});

test("priceless yard plate falls back to initials │ count", async () => {
  const { getByText } = await render(<YardPin yard={{ ...YARD, price_from: 0 }} />);
  expect(getByText("KH")).toBeTruthy();
  expect(getByText("8")).toBeTruthy();
});

test("zero-match yard dims to 40% but still renders (never removed)", async () => {
  const { getByLabelText } = await render(
    <YardPin yard={{ ...YARD, matching_count: 0 }} filtered />,
  );
  const pin = getByLabelText(
    "Yard: Apapa Yard, 0 listings, from ₦250,000 a day, verified supplier",
  );
  expect(pin.props.style).toMatchObject({ opacity: 0.4 });
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

test("selected plates switch to the BRAND frame — primary.500, not the warning amber", async () => {
  const { getByLabelText } = await render(<AssetPin listing={SOLO} selected />);
  const pin = getByLabelText("Plant & Machinery listing: 20t Excavator, from ₦250,000 a day");
  expect(pin.props.style).toMatchObject({
    borderColor: tokens.color.colorPrimary500,
    borderWidth: 2,
  });
  // D-028 regression guard: amber is the warning hue and must never mark selection.
  expect(pin.props.style.borderColor).not.toBe(tokens.color.colorAmber500);
});

test("selecting a yard changes the frame, NOT the anatomy — no company, no glyphs, no price row", async () => {
  // The 2026-08-08 revision: the selected pin used to redraw the whole bottom
  // card (initials │ count │ class glyphs over `from ₦250k`, plus a seal).
  const selected = await render(<YardPin yard={YARD} selected />);
  expect(selected.getByText(compactNaira(YARD.price_from))).toBeTruthy();
  expect(selected.getByText("8")).toBeTruthy();
  expect(selected.queryByText("KH")).toBeNull();
  expect(selected.queryByText(`from ${compactNaira(YARD.price_from)}`)).toBeNull();
  expect(selected.queryByTestId("yard-class-glyphs")).toBeNull();
  expect(selected.queryByTestId("yard-verified-seal")).toBeNull();
});

test("the selected plate never grows sideways under the finger", async () => {
  // Same layout, same paddings — only the frame and type size change, so a
  // tapped pin does not re-anchor away from the tap point.
  const unselected = await render(<YardPin yard={YARD} />);
  const selected = await render(<YardPin yard={YARD} selected />);
  const rowOf = (r: ReturnType<typeof render> extends Promise<infer T> ? T : never) =>
    styleOf(r.getByText("8").parent as never);
  expect(rowOf(unselected as never)?.paddingHorizontal).toBe(
    rowOf(selected as never)?.paddingHorizontal,
  );
});

test("verification survives for screen readers even though the plate stopped drawing a seal", async () => {
  const { getByLabelText } = await render(<YardPin yard={YARD} />);
  expect(
    getByLabelText("Yard: Apapa Yard, 8 listings, from ₦250,000 a day, verified supplier"),
  ).toBeTruthy();
});
