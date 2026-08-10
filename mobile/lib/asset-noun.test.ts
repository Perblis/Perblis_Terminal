import { assetNoun, countNoun, nounFor } from "./asset-noun";

test("a storefront of places is called facilities", () => {
  expect(assetNoun(["warehousing"])).toMatchObject({ one: "facility", many: "facilities" });
  expect(assetNoun(["warehousing", "terminals_yards", "land_staging"]).kind).toBe("facility");
});

test("a storefront of machines is called assets", () => {
  expect(assetNoun(["plant_machinery"])).toMatchObject({ one: "asset", many: "assets" });
  expect(assetNoun(["plant_machinery", "trucks_haulage"]).kind).toBe("asset");
});

test("a mixed storefront falls back to the Lexicon's own word", () => {
  // 8 of the 16 seeded storefronts are multi-class; 5 straddle this split —
  // onne-logistics carries land + plant + terminals + trucks on one page.
  expect(assetNoun(["warehousing", "plant_machinery"]).kind).toBe("listing");
  expect(assetNoun(["land_staging", "plant_machinery", "terminals_yards", "trucks_haulage"])).toMatchObject({
    one: "listing",
    many: "listings",
  });
});

test("an empty storefront is called listings, never facilities", () => {
  expect(assetNoun([]).kind).toBe("listing");
});

test("duplicate classes do not change the verdict", () => {
  // The rule counts DISTINCT classes — three cold stores are still one class.
  expect(assetNoun(["warehousing", "warehousing", "warehousing"]).kind).toBe("facility");
  expect(assetNoun(["plant_machinery", "plant_machinery"]).kind).toBe("asset");
});

test("a card follows the thing it opens, not the page it sits on", () => {
  // On a mixed storefront (noun: listings) a cold-store card still says facility.
  expect(nounFor("warehousing").one).toBe("facility");
  expect(nounFor("trucks_haulage").one).toBe("asset");
});

test("counts agree with their noun", () => {
  expect(countNoun(3, assetNoun(["warehousing"]))).toBe("3 facilities");
  expect(countNoun(1, assetNoun(["warehousing"]))).toBe("1 facility");
  expect(countNoun(0, assetNoun(["plant_machinery"]))).toBe("0 assets");
});

test("a yard's class_mix drives the noun on the map surfaces", () => {
  // A cold-chain yard reads as facilities; a plant yard as assets; a yard
  // holding both falls back, because neither word is true of everything in it.
  expect(countNoun(3, assetNoun(["warehousing"]))).toBe("3 facilities");
  expect(countNoun(5, assetNoun(["plant_machinery", "trucks_haulage"]))).toBe("5 assets");
  expect(countNoun(4, assetNoun(["terminals_yards", "trucks_haulage"]))).toBe("4 listings");
});

test("a single-class search page names its class, a mixed page does not", () => {
  // S12 derives the noun from the rows actually on screen.
  const coldRooms = ["warehousing", "warehousing", "warehousing"] as const;
  expect(assetNoun(coldRooms).many).toBe("facilities");
  const mixed = ["warehousing", "plant_machinery"] as const;
  expect(assetNoun(mixed).many).toBe("listings");
  // An empty page has nothing to name.
  expect(assetNoun([]).many).toBe("listings");
});
