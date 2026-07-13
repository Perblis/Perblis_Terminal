// The free-text search q is shared by S4 map + S12 search (a query typed on
// the search screen still filters the map), but — like dateRange — it is
// per-launch intent and must never persist across sessions.
import { mmkv } from "../../storage/mmkv";
import { useMapState, LAGOS_DEFAULT } from "../../stores/map-state";

beforeEach(() => {
  useMapState.setState({
    region: LAGOS_DEFAULT,
    classFilter: null,
    dateRange: null,
    q: "",
    pendingFocus: null,
  });
});

test("setQ shares the query app-wide", () => {
  useMapState.getState().setQ("30t excavator");
  expect(useMapState.getState().q).toBe("30t excavator");
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
