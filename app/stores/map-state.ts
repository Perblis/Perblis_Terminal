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

export type DateRange = { from: string; to: string };

type MapState = {
  /** Region + filters persist across sessions (J8 — the app remembers). */
  region: MapRegion;
  classFilter: AssetClass | null;
  /** Hire-window filter (both dates or none) — shared by S4 map + S12 search
   *  so 'available' means "for these dates". Deliberately NOT persisted:
   *  yesterday's dates are stale intent. */
  dateRange: DateRange | null;
  /** One-shot camera request from another screen (e.g. S13 yard card → S4);
   *  the map consumes and clears it. Never persisted. */
  pendingFocus: MapRegion | null;
  setRegion: (region: MapRegion) => void;
  setClassFilter: (c: AssetClass | null) => void;
  setDateRange: (r: DateRange | null) => void;
  requestFocus: (region: MapRegion) => void;
  clearFocus: () => void;
};

export const useMapState = create<MapState>()(
  persist(
    (set) => ({
      region: LAGOS_DEFAULT,
      classFilter: null,
      dateRange: null,
      pendingFocus: null,
      setRegion: (region) => set({ region }),
      setClassFilter: (classFilter) => set({ classFilter }),
      setDateRange: (dateRange) => set({ dateRange }),
      // Seed region too, so a cold-mounted map opens on target directly.
      requestFocus: (region) => set({ pendingFocus: region, region }),
      clearFocus: () => set({ pendingFocus: null }),
    }),
    {
      name: "terminal.map-state",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s) => ({ region: s.region, classFilter: s.classFilter }),
    },
  ),
);
