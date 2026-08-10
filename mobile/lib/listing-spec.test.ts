import { findMeasures, listingCardSpec, pickMeasure } from "./listing-spec";

test("reads the measure a supplier wrote and canonicalises the unit", () => {
  expect(pickMeasure("Transit Concrete Mixer 8 m³", "plant_machinery")?.text).toBe("8 m³");
  expect(pickMeasure("Lowbed Trailer 60t", "trucks_haulage")?.text).toBe("60 t");
  expect(pickMeasure("250 kVA Generator", "plant_machinery")?.text).toBe("250 kVA");
  expect(pickMeasure("Dry Warehouse 20,000 sqm", "warehousing")?.text).toBe("20,000 sqm");
  expect(pickMeasure("Bonded Depot 1,200 TEU", "terminals_yards")?.text).toBe("1,200 TEU");
  expect(pickMeasure("Staging Yard 4.5 hectares", "land_staging")?.text).toBe("4.5 ha");
});

test("the class decides which figure wins when a title carries several", () => {
  // A container yard is scanned by TEU, not by the gate width that precedes it.
  expect(pickMeasure("Container Yard 20 ft gates 1,200 TEU", "terminals_yards")?.text).toBe(
    "1,200 TEU",
  );
  // The same string for plant has no mass/power/volume figure, so the length
  // figure — the only one — is used rather than nothing.
  expect(pickMeasure("Boom Lift 20 ft platform", "plant_machinery")?.text).toBe("20 ft");
  // Payload is what a haulage hirer buys; the bed length is secondary.
  expect(pickMeasure("Flatbed 12 m deck 30 tonnes payload", "trucks_haulage")?.text).toBe("30 t");
});

test("letters and digits adjacent to a figure never open a measure", () => {
  // "8x4" is a drive configuration; its "4" must not become "4 t".
  expect(findMeasures("8x4 Tipper Truck")).toEqual([]);
  // A model number is not a spec.
  expect(findMeasures("Excavator A320m")).toEqual([]);
  // "2 trailers" must not read as tonnes.
  expect(findMeasures("2 trailers available")).toEqual([]);
  // A bare year has no unit at all.
  expect(findMeasures("2019 Bulldozer")).toEqual([]);
});

test("the surfaced figure is lifted out of the name so it never shows twice", () => {
  expect(
    listingCardSpec({
      title: "Transit Concrete Mixer 8 m³ — ready-mix delivery",
      asset_type: "Concrete Mixer (transit)",
      asset_class: "plant_machinery",
    }),
  ).toEqual({ name: "Transit Concrete Mixer", spec: "8 m³", figure: true });

  expect(
    listingCardSpec({
      title: "250 kVA Generator",
      asset_type: "Generator",
      asset_class: "plant_machinery",
    }),
  ).toEqual({ name: "Generator", spec: "250 kVA", figure: true });
});

test("a figure inside the qualifier is shown but NOT cut from the name", () => {
  expect(
    listingCardSpec({
      title: "Truck Head — pulls 40 t trailers",
      asset_type: "Truck Head (tractor unit)",
      asset_class: "trucks_haulage",
    }),
  ).toEqual({ name: "Truck Head", spec: "40 t", figure: true });
});

test("with no figure, the asset type carries the line — never the class", () => {
  expect(
    listingCardSpec({
      title: "Komatsu Crawler — site clearing",
      asset_type: "Bulldozer",
      asset_class: "plant_machinery",
    }),
  ).toEqual({ name: "Komatsu Crawler", spec: "Bulldozer", figure: false });
});

test("when the type is already in the name, the qualifier takes the line", () => {
  expect(
    listingCardSpec({
      title: "Site Excavator — trenching and drainage",
      asset_type: "Excavator",
      asset_class: "plant_machinery",
    }),
  ).toEqual({ name: "Site Excavator", spec: "Trenching and drainage", figure: false });
});

test("falls back to the class label only when nothing else exists", () => {
  expect(
    listingCardSpec({ title: "Excavator", asset_type: "Excavator", asset_class: "plant_machinery" }),
  ).toEqual({ name: "Excavator", spec: "Plant & Machinery", figure: false });
});

test("stripping a figure never empties the name", () => {
  // The whole title is the measure — keep it rather than render a blank card.
  expect(
    listingCardSpec({ title: "60 t", asset_type: "Mobile Crane", asset_class: "plant_machinery" }),
  ).toEqual({ name: "60 t", spec: "60 t", figure: true });
});

test("a missing or blank title degrades quietly", () => {
  expect(
    listingCardSpec({ title: "", asset_type: "Dry Warehouse", asset_class: "warehousing" }),
  ).toEqual({ name: "", spec: "Dry Warehouse", figure: false });
});

test("the shared regex is reset between calls (global flag reuse)", () => {
  const title = "Wheel Loader 3.2 m³ bucket";
  expect(pickMeasure(title, "plant_machinery")?.text).toBe("3.2 m³");
  expect(pickMeasure(title, "plant_machinery")?.text).toBe("3.2 m³");
});
