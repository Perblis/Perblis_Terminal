import { isValidBbox, listSearchQuery, mapSearchQuery } from "./search-params";
import { parseNairaInput } from "./naira";

const BBOX = { minLng: 3.35, minLat: 6.4, maxLng: 3.45, maxLat: 6.5 };

test("map query: bbox + filters, kobo prices verbatim", () => {
  const q = mapSearchQuery(BBOX, {
    assetClass: "plant_machinery",
    q: " excavator ",
    priceMinKobo: parseNairaInput("250,000"),
    priceMaxKobo: parseNairaInput("900,000"),
    specMin: 20,
  });
  const p = new URLSearchParams(q);
  expect(p.get("bbox")).toBe("3.350000,6.400000,3.450000,6.500000");
  expect(p.get("asset_class")).toBe("plant_machinery");
  expect(p.get("q")).toBe("excavator");
  expect(p.get("price_min")).toBe("25000000"); // ₦250,000 → kobo
  expect(p.get("price_max")).toBe("90000000");
  expect(p.get("spec_min")).toBe("20");
});

test("spec bounds are DROPPED without a class (server 400s otherwise)", () => {
  const p = new URLSearchParams(mapSearchQuery(BBOX, { specMin: 20, specMax: 40 }));
  expect(p.get("spec_min")).toBeNull();
  expect(p.get("spec_max")).toBeNull();
});

test("list query: radius mode + grouping + page size", () => {
  const p = new URLSearchParams(
    listSearchQuery({ lat: 6.4541, lng: 3.3947, radiusKm: 25 }, {}, "location", 50),
  );
  expect(p.get("lat")).toBe("6.454100");
  expect(p.get("radius_km")).toBe("25");
  expect(p.get("group_by")).toBe("location");
  expect(p.get("page_size")).toBe("50");
  expect(p.get("bbox")).toBeNull(); // bbox XOR radius
});

test("date window goes both-or-neither (server 400s a lone bound)", () => {
  const both = new URLSearchParams(
    mapSearchQuery(BBOX, { dateFrom: "2026-08-10", dateTo: "2026-08-14" }),
  );
  expect(both.get("date_from")).toBe("2026-08-10");
  expect(both.get("date_to")).toBe("2026-08-14");

  const lone = new URLSearchParams(mapSearchQuery(BBOX, { dateFrom: "2026-08-10" }));
  expect(lone.get("date_from")).toBeNull();
  expect(lone.get("date_to")).toBeNull();
});

test("bbox validity", () => {
  expect(isValidBbox(BBOX)).toBe(true);
  expect(isValidBbox({ ...BBOX, maxLng: BBOX.minLng })).toBe(false);
  expect(isValidBbox({ ...BBOX, maxLat: Number.NaN })).toBe(false);
});
