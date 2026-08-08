// Terminal Chart grade (D-022) — the 2026-08-08 discovery-layer revision.
//
// These tests pin the ORDER-SENSITIVE parts of packages/tokens/map/grade.json,
// because applyGrade is first-match-wins and the rules use substring tests on
// layer ids. A reordering that looks harmless silently changes the map: the
// original grade hid `water_name_point_label` by accident because "poi" is a
// substring of "point".
//
// Layer ids below are the real OpenFreeMap Liberty ids (111 layers), not
// invented ones — `curl $(jq -r .styleUrl grade.json) | jq '.layers[].id'`.
import grade from "@terminal/tokens/map/grade.json";

import { applyGrade, LIBERTY_URL, type MapTheme } from "./map-style";

type Layer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

/** A representative slice of Liberty, one layer per rule group. */
const LIBERTY_SAMPLE: Layer[] = [
  { id: "background", type: "background" },
  { id: "natural_earth", type: "raster" },
  { id: "water", type: "fill" },
  { id: "waterway_river", type: "line" },
  { id: "waterway_tunnel", type: "line" },
  { id: "landuse_residential", type: "fill" },
  { id: "landcover_wood", type: "fill" },
  { id: "building", type: "fill" },
  { id: "building-3d", type: "fill-extrusion" },
  { id: "park_outline", type: "line" },
  { id: "aeroway_runway", type: "line" },
  { id: "water_name_point_label", type: "symbol" },
  { id: "water_name_line_label", type: "symbol" },
  { id: "poi_r20", type: "symbol" },
  { id: "airport", type: "symbol" },
  { id: "highway-shield-non-us", type: "symbol" },
  { id: "road_one_way_arrow", type: "symbol" },
  { id: "highway-name-major", type: "symbol" },
  { id: "label_city", type: "symbol" },
  { id: "label_country_1", type: "symbol" },
  { id: "label_village", type: "symbol" },
  { id: "label_other", type: "symbol" },
  { id: "boundary_2", type: "line" },
  { id: "boundary_3", type: "line" },
  { id: "road_motorway", type: "line" },
  { id: "road_trunk_primary", type: "line" },
  { id: "road_minor", type: "line" },
  { id: "tunnel_street_casing", type: "line" },
];

function graded(theme: MapTheme) {
  const out = applyGrade({ layers: LIBERTY_SAMPLE }, theme);
  return new Map(out.layers.map((l) => [l.id, l]));
}

const INK_900 = "#19191C";
const INK_850 = "#1A1C1E";
const INK_800 = "#1E1F22";
const INK_700 = "#26272B";
const INK_600 = "#2D2F33";
const INK_400 = "#707174";
const INK_300 = "#ADAEB0";

test("the grade still targets OpenFreeMap Liberty", () => {
  expect(LIBERTY_URL).toBe("https://tiles.openfreemap.org/styles/liberty");
  expect(grade.themes.dark.rules.length).toBeGreaterThan(0);
});

test("landuse/landcover all sink to ink-850 — landuse_residential was the grey blob", () => {
  const g = graded("dark");
  // Liberty paints landuse_residential hsla(0,3%,85%,.84) up to z12: the bright
  // grey landmass the founder saw. Every landcover family must flatten.
  for (const id of ["landuse_residential", "landcover_wood", "building"]) {
    expect(g.get(id)?.paint?.["fill-color"]).toBe(INK_850);
  }
  expect(g.get("building-3d")?.paint?.["fill-extrusion-color"]).toBe(INK_850);
  // Park outlines and runway linework vanish into the land they sit on.
  expect(g.get("park_outline")?.paint?.["line-color"]).toBe(INK_850);
  expect(g.get("aeroway_runway")?.paint?.["line-color"]).toBe(INK_850);
});

test("waterways are graded BEFORE the road rule (waterway_tunnel contains 'tunnel')", () => {
  const g = graded("dark");
  expect(g.get("waterway_river")?.paint?.["line-color"]).toBe(INK_850);
  // The trap: without ordering, waterway_tunnel would be painted as a road.
  expect(g.get("waterway_tunnel")?.paint?.["line-color"]).toBe(INK_850);
});

test("water names are graded BEFORE the POI rule ('poi' is a substring of 'point')", () => {
  const g = graded("dark");
  const pointLabel = g.get("water_name_point_label");
  // The bug this pins: the POI rule hid it outright.
  expect(pointLabel?.layout?.visibility).toBeUndefined();
  expect(pointLabel?.paint?.["text-color"]).toBe(INK_400);
  expect(g.get("water_name_line_label")?.paint?.["text-opacity"]).toBe(0.7);
});

test("POI, airport, route shields and one-way arrows are off — pins are the content", () => {
  const g = graded("dark");
  for (const id of ["poi_r20", "airport", "highway-shield-non-us", "road_one_way_arrow"]) {
    expect(g.get(id)?.layout?.visibility).toBe("none");
  }
});

test("street names ramp in only at neighbourhood zoom", () => {
  const g = graded("dark");
  const opacity = g.get("highway-name-major")?.paint?.["text-opacity"];
  expect(opacity).toEqual(["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, 0.55]);
  expect(g.get("highway-name-major")?.paint?.["text-color"]).toBe(INK_400);
});

test("place labels gain a hierarchy — anchors legible, villages quieter", () => {
  const g = graded("dark");
  for (const id of ["label_city", "label_country_1"]) {
    expect(g.get(id)?.paint?.["text-color"]).toBe(INK_300);
  }
  for (const id of ["label_village", "label_other"]) {
    expect(g.get(id)?.paint?.["text-color"]).toBe(INK_400);
  }
});

test("roads gain a hierarchy and boundaries recede to faint structure", () => {
  const g = graded("dark");
  expect(g.get("road_motorway")?.paint?.["line-color"]).toBe(INK_600);
  expect(g.get("road_trunk_primary")?.paint?.["line-color"]).toBe(INK_600);
  expect(g.get("road_minor")?.paint?.["line-color"]).toBe(INK_800);
  expect(g.get("tunnel_street_casing")?.paint?.["line-color"]).toBe(INK_800);
  for (const id of ["boundary_2", "boundary_3"]) {
    expect(g.get(id)?.paint?.["line-color"]).toBe(INK_700);
    expect(g.get(id)?.paint?.["line-opacity"]).toBe(0.35);
  }
});

test("land is ink-900 and the world-zoom relief raster is held down", () => {
  const g = graded("dark");
  expect(g.get("background")?.paint?.["background-color"]).toBe(INK_900);
  expect(g.get("natural_earth")?.paint?.["raster-opacity"]).toBe(0.08);
});

test("every sampled Liberty layer is claimed by a rule in BOTH themes", () => {
  // Regression guard for the real failure mode: a layer nobody names keeps
  // Liberty's own bright default and reintroduces the noise.
  for (const theme of ["dark", "light"] as MapTheme[]) {
    const g = graded(theme);
    for (const layer of LIBERTY_SAMPLE) {
      const out = g.get(layer.id);
      const touched =
        Object.keys(out?.paint ?? {}).length > 0 || Object.keys(out?.layout ?? {}).length > 0;
      expect([layer.id, theme, touched]).toEqual([layer.id, theme, true]);
    }
  }
});

test("applyGrade is pure — the input style is never mutated", () => {
  const input = { layers: [{ id: "landuse_residential", type: "fill" }] };
  applyGrade(input, "dark");
  expect(input.layers[0]).toEqual({ id: "landuse_residential", type: "fill" });
});
