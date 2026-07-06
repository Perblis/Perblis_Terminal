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

type MapState = {
  /** Region + filters persist across sessions (J8 — the app remembers). */
  region: MapRegion;
  classFilter: AssetClass | null;
  setRegion: (region: MapRegion) => void;
  setClassFilter: (c: AssetClass | null) => void;
};

export const useMapState = create<MapState>()(
  persist(
    (set) => ({
      region: LAGOS_DEFAULT,
      classFilter: null,
      setRegion: (region) => set({ region }),
      setClassFilter: (classFilter) => set({ classFilter }),
    }),
    { name: "terminal.map-state", storage: createJSONStorage(() => zustandStorage) },
  ),
);
