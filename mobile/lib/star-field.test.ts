// Documents the copy-coupling to backend/listings/spec_data.py::_STAR_FIELDS.
// If a class's ★ field, label or unit changes there, this file must change too
// — the client has no runtime way to discover it (GET /spec-templates needs an
// asset_type, and search filters by class).
import { ASSET_CLASSES } from "./asset-classes";
import { STAR_FIELDS, starField, starFieldChipLabel, starFieldTitle } from "./star-field";
import type { AssetClass } from "./types";

test("every asset class has a ★ field — no class can fall through unnamed", () => {
  for (const meta of ASSET_CLASSES) {
    const field = starField(meta.value);
    expect([meta.value, field !== null]).toEqual([meta.value, true]);
    expect(field!.key).toMatch(/^[a-z_]+$/);
    expect(field!.label.length).toBeGreaterThan(0);
    expect(field!.unit.length).toBeGreaterThan(0);
  }
  // The mirror covers the class list exactly — no extras, no gaps.
  expect(Object.keys(STAR_FIELDS).sort()).toEqual(ASSET_CLASSES.map((c) => c.value).sort());
});

test("the mirror matches spec_data.py::_STAR_FIELDS verbatim", () => {
  expect(STAR_FIELDS).toEqual({
    plant_machinery: { key: "operating_weight", label: "Operating weight", unit: "tonnes" },
    trucks_haulage: { key: "payload_capacity", label: "Payload capacity", unit: "tonnes" },
    warehousing: { key: "floor_area", label: "Floor area", unit: "sqm" },
    terminals_yards: { key: "container_capacity", label: "Container capacity", unit: "TEU" },
    land_staging: { key: "area", label: "Area", unit: "sqm" },
  });
});

test("no class selected ⇒ no ★ field (the server 400s a spec bound without one)", () => {
  expect(starField(null)).toBeNull();
  expect(starField(undefined)).toBeNull();
  expect(starFieldTitle(null)).toBe("Specifications");
});

test("the section title names the field and its unit", () => {
  expect(starFieldTitle("plant_machinery")).toBe("Operating weight (tonnes)");
  expect(starFieldTitle("terminals_yards")).toBe("Container capacity (TEU)");
});

test("the chip label stays readable with one bound, both bounds, or neither", () => {
  expect(starFieldChipLabel("plant_machinery", "10", "30")).toBe("Operating weight 10–30 tonnes");
  expect(starFieldChipLabel("plant_machinery", "10", "")).toBe("Operating weight 10–… tonnes");
  expect(starFieldChipLabel("plant_machinery", "", "30")).toBe("Operating weight …–30 tonnes");
  // Defensive: an unknown class must not crash the chip row.
  expect(starFieldChipLabel("nonsense" as AssetClass, "1", "2")).toBe("★ 1–2");
});
