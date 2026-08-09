import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "../storage/mmkv";
import type { AssetClass } from "../lib/types";

export type MapRegion = {
  centerLng: number;
  centerLat: number;
  zoom: number;
};

/** FSD §6: permission denied / cold default → Lagos Island. */
export const LAGOS_DEFAULT: MapRegion = { centerLng: 3.3947, centerLat: 6.4541, zoom: 12 };

/** The /search/list radius chip that is on when the user has chosen nothing. */
export const DEFAULT_RADIUS_KM = 25;

export type DateRange = { from: string; to: string };

type MapState = {
  /** Region + filters persist across sessions (J8 — the app remembers). */
  region: MapRegion;
  classFilter: AssetClass | null;
  /** Hire-window filter (both dates or none) — shared by S4 map + S12 search
   *  so 'available' means "for these dates". Deliberately NOT persisted:
   *  yesterday's dates are stale intent. */
  dateRange: DateRange | null;
  /** Free-text search — shared by S4 map + S12 search so a query typed on
   *  the search screen still applies when returning to the map. Like
   *  dateRange, NOT persisted: yesterday's search is stale intent.
   *
   *  Written by the *debounced* commit in S12, never per keystroke — see
   *  lib/use-debounced-commit.ts. Everything downstream (query keys, chips,
   *  the map) reads this, so it must move once per settled query, not once
   *  per character. */
  q: string;
  /** The rest of the S12 filter set. These used to be `useState` inside the
   *  search screen, which meant they silently reset on every remount while
   *  class/q/dates survived, and the map could never be told about them —
   *  so the two surfaces were structurally unable to agree on a result set.
   *  Money is held as the raw naira *input string* (what the user typed);
   *  the ₦→kobo conversion stays at the form edge (lib/naira.ts). */
  radiusKm: number;
  priceMin: string;
  priceMax: string;
  /** Bounds on the active class's ★ headline spec. Meaningless without a
   *  class (the server 400s a bound without one), so setClassFilter clears
   *  them — a stale bound from a previous class is never silently applied. */
  specMin: string;
  specMax: string;
  /** One-shot camera request from another screen (e.g. S13 yard card → S4);
   *  the map consumes and clears it. Never persisted. */
  pendingFocus: MapRegion | null;
  setRegion: (region: MapRegion) => void;
  setClassFilter: (c: AssetClass | null) => void;
  setDateRange: (r: DateRange | null) => void;
  setQ: (q: string) => void;
  setRadiusKm: (km: number) => void;
  setPriceMin: (v: string) => void;
  setPriceMax: (v: string) => void;
  setSpecMin: (v: string) => void;
  setSpecMax: (v: string) => void;
  /** Everything the "Clear all" affordance clears, in one commit. */
  clearFilters: () => void;
  requestFocus: (region: MapRegion) => void;
  clearFocus: () => void;
};

const CLEARED = {
  classFilter: null,
  dateRange: null,
  q: "",
  radiusKm: DEFAULT_RADIUS_KM,
  priceMin: "",
  priceMax: "",
  specMin: "",
  specMax: "",
} as const;

export const useMapState = create<MapState>()(
  persist(
    (set) => ({
      region: LAGOS_DEFAULT,
      ...CLEARED,
      pendingFocus: null,
      setRegion: (region) => set({ region }),
      // Changing (or clearing) the class invalidates the ★ bounds with it:
      // the field and its unit differ per class, so carrying "10–30 tonnes"
      // over to Warehousing would filter on floor area without saying so.
      setClassFilter: (classFilter) => set({ classFilter, specMin: "", specMax: "" }),
      setDateRange: (dateRange) => set({ dateRange }),
      setQ: (q) => set({ q }),
      setRadiusKm: (radiusKm) => set({ radiusKm }),
      setPriceMin: (priceMin) => set({ priceMin }),
      setPriceMax: (priceMax) => set({ priceMax }),
      setSpecMin: (specMin) => set({ specMin }),
      setSpecMax: (specMax) => set({ specMax }),
      clearFilters: () => set({ ...CLEARED }),
      // Seed region too, so a cold-mounted map opens on target directly.
      requestFocus: (region) => set({ pendingFocus: region, region }),
      clearFocus: () => set({ pendingFocus: null }),
    }),
    {
      name: "terminal.map-state",
      storage: createJSONStorage(() => zustandStorage),
      // Durable preferences only. Radius joins region and class: it is a
      // viewport habit ("I hire within 50 km"), not stale intent the way a
      // query, a hire window or a price ceiling is.
      partialize: (s) => ({ region: s.region, classFilter: s.classFilter, radiusKm: s.radiusKm }),
    },
  ),
);

/** True when a content filter is narrowing the result set.
 *
 *  Drives the map's dimming and which count a yard pin badges (pins.tsx). The
 *  hire window is deliberately excluded: `common.matches()` never checks
 *  availability, so dates do not change `matching_count`, and treating them as
 *  a filter would dim pins that do in fact match. */
export function hasContentFilter(s: {
  classFilter: AssetClass | null;
  q: string;
  priceMin: string;
  priceMax: string;
  specMin: string;
  specMax: string;
}): boolean {
  return (
    s.classFilter !== null ||
    s.q.trim() !== "" ||
    s.priceMin !== "" ||
    s.priceMax !== "" ||
    s.specMin !== "" ||
    s.specMax !== ""
  );
}
