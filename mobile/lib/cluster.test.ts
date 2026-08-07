import { buildSoloIndex, getSoloFeatures } from "./cluster";
import type { MapSoloListing } from "./types";

const BBOX = { minLng: 3.0, minLat: 6.0, maxLng: 4.0, maxLat: 7.0 };

function solo(id: string, lng: number, lat: number): MapSoloListing {
  return {
    id,
    title: `Listing ${id}`,
    asset_class: "plant_machinery",
    point: { type: "Point", coordinates: [lng, lat] },
    price_from: 25000000,
    price_from_display: "₦250,000",
    distance_km: 1,
    photo: "",
    badge: "basic",
    available: true,
  };
}

test("coincident pins cluster at low zoom and dissolve at high zoom", () => {
  const index = buildSoloIndex([
    solo("a", 3.4, 6.45),
    solo("b", 3.4001, 6.4501),
    solo("c", 3.7, 6.8),
  ]);

  const low = getSoloFeatures(index, BBOX, 8);
  const clusters = low.filter((f) => f.kind === "cluster");
  expect(clusters).toHaveLength(1);
  expect(clusters[0].kind === "cluster" && clusters[0].count).toBe(2);
  expect(low.filter((f) => f.kind === "solo")).toHaveLength(1);

  const high = getSoloFeatures(index, BBOX, 16);
  expect(high.filter((f) => f.kind === "cluster")).toHaveLength(0);
  expect(high.filter((f) => f.kind === "solo")).toHaveLength(3);
});

test("cluster expansion zoom is a real zoom-in target", () => {
  const index = buildSoloIndex([solo("a", 3.4, 6.45), solo("b", 3.41, 6.46)]);
  const [cluster] = getSoloFeatures(index, BBOX, 6).filter((f) => f.kind === "cluster");
  expect(cluster.kind).toBe("cluster");
  if (cluster.kind === "cluster") {
    expect(cluster.expansionZoom).toBeGreaterThan(6);
  }
});

test("empty input yields no features", () => {
  expect(getSoloFeatures(buildSoloIndex([]), BBOX, 10)).toEqual([]);
});
