// The free-text search q is shared by S4 map + S12 search (a query typed on
// the search screen still filters the map), but — like dateRange — it is
// per-launch intent and must never persist across sessions.
//
// The rest of the filter set (radius, price, ★ bounds) moved here on
// 2026-08-10: it used to be `useState` inside the search screen, so it reset
// on every remount while class/q/dates survived, and the map could never be
// sent it. One store is what lets S4 and S12 filter the same result set.
import { mmkv } from "../../storage/mmkv";
import {
  DEFAULT_RADIUS_KM,
  hasContentFilter,
  useMapState,
  LAGOS_DEFAULT,
} from "../../stores/map-state";

const EMPTY = {
  region: LAGOS_DEFAULT,
  classFilter: null,
  dateRange: null,
  q: "",
  radiusKm: DEFAULT_RADIUS_KM,
  priceMin: "",
  priceMax: "",
  specMin: "",
  specMax: "",
  pendingFocus: null,
} as const;

beforeEach(() => {
  useMapState.setState({ ...EMPTY });
});

test("setQ shares the query app-wide", () => {
  useMapState.getState().setQ("22t excavator");
  expect(useMapState.getState().q).toBe("22t excavator");
});

test("q and dateRange are per-launch intent and never persisted", () => {
  useMapState.getState().setQ("crane");
  useMapState.getState().setDateRange({ from: "2026-08-01", to: "2026-08-05" });
  useMapState.getState().setClassFilter("plant_machinery");
  const raw = mmkv.getString("terminal.map-state");
  expect(raw).toBeTruthy();
  const state = JSON.parse(raw!).state;
  expect(state.q).toBeUndefined();
  expect(state.dateRange).toBeUndefined();
  expect(state.classFilter).toBe("plant_machinery"); // filters DO persist (J8)
});

test("radius persists as a viewport habit; price and ★ bounds do not", () => {
  useMapState.getState().setRadiusKm(50);
  useMapState.getState().setPriceMax("250000");
  useMapState.getState().setClassFilter("plant_machinery");
  useMapState.getState().setSpecMin("20");

  const state = JSON.parse(mmkv.getString("terminal.map-state")!).state;
  expect(state.radiusKm).toBe(50);
  expect(state.priceMax).toBeUndefined();
  expect(state.specMin).toBeUndefined();
});

test("changing the class drops the ★ bounds it was scoped to", () => {
  useMapState.getState().setClassFilter("plant_machinery");
  useMapState.getState().setSpecMin("10");
  useMapState.getState().setSpecMax("30");

  // "10–30 tonnes operating weight" is meaningless as "10–30 sqm floor area".
  useMapState.getState().setClassFilter("warehousing");
  expect(useMapState.getState().specMin).toBe("");
  expect(useMapState.getState().specMax).toBe("");
});

test("clearing the class drops the ★ bounds too", () => {
  useMapState.getState().setClassFilter("plant_machinery");
  useMapState.getState().setSpecMax("30");

  // Without a class the server 400s a ★ bound, so search-params drops it —
  // leaving it in the store would light a chip for a filter nothing applies.
  useMapState.getState().setClassFilter(null);
  expect(useMapState.getState().specMax).toBe("");
});

test("clearFilters resets every filter, radius included", () => {
  const s = useMapState.getState();
  s.setQ("crane");
  s.setClassFilter("trucks_haulage");
  s.setDateRange({ from: "2026-08-01", to: "2026-08-05" });
  s.setRadiusKm(100);
  s.setPriceMin("50000");
  s.setPriceMax("250000");

  useMapState.getState().clearFilters();

  const after = useMapState.getState();
  expect(after.q).toBe("");
  expect(after.classFilter).toBeNull();
  expect(after.dateRange).toBeNull();
  expect(after.radiusKm).toBe(DEFAULT_RADIUS_KM);
  expect(after.priceMin).toBe("");
  expect(after.priceMax).toBe("");
});

test("clearFilters leaves the map where the user left it", () => {
  const region = { centerLng: 7.49, centerLat: 9.06, zoom: 13 };
  useMapState.getState().setRegion(region);
  useMapState.getState().clearFilters();
  expect(useMapState.getState().region).toEqual(region);
});

describe("hasContentFilter — what makes the map dim and switch counts", () => {
  const none = { classFilter: null, q: "", priceMin: "", priceMax: "", specMin: "", specMax: "" };

  test("no filters", () => {
    expect(hasContentFilter(none)).toBe(false);
  });

  test("a text query counts — this is the bug the map had", () => {
    // pins.tsx keys both the dimming and which count it badges off this flag.
    // While it was `classFilter !== null`, a query left pins at full opacity
    // badging listing_count while the header reported matching_count.
    expect(hasContentFilter({ ...none, q: "excavator" })).toBe(true);
  });

  test("whitespace is not a query", () => {
    expect(hasContentFilter({ ...none, q: "   " })).toBe(false);
  });

  test.each(["classFilter", "priceMin", "priceMax", "specMin", "specMax"] as const)(
    "%s counts",
    (field) => {
      const value = field === "classFilter" ? "plant_machinery" : "1";
      expect(hasContentFilter({ ...none, [field]: value })).toBe(true);
    },
  );
});
