// JS-side pin hit-testing for map presses. The library's native Marker
// onPress is unreliable on physical Android devices (maplibre-react-native
// #557/#1018 lineage), so the map's own onPress event — which always fires —
// resolves the tapped pin here instead. Pure Web Mercator math, unit-tested;
// the native path stays wired as a bonus (when it works it consumes the tap
// before the map-level handler runs).
import type { MapSoloListing, MapYard } from "./types";

export type PressablePin =
  | { kind: "yard"; yard: MapYard; lng: number; lat: number }
  | { kind: "solo"; listing: MapSoloListing; lng: number; lat: number }
  | { kind: "cluster"; id: number; count: number; expansionZoom: number; lng: number; lat: number };

const WORLD_TILE = 512; // MapLibre GL logical world size at zoom 0

/** Project lng/lat to Web Mercator logical pixels at a zoom level. */
export function projectToPixels(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const worldSize = WORLD_TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * worldSize;
  const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat));
  const phi = (clampedLat * Math.PI) / 180;
  const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) * worldSize;
  return { x, y };
}

/**
 * The pin whose on-screen position is nearest the press, within
 * `thresholdPx` logical pixels — or null for a bare-map press. Pins are
 * anchored center, so the coordinate IS the visual centre.
 */
export function findPressedPin(
  pins: readonly PressablePin[],
  press: { lng: number; lat: number },
  zoom: number,
  thresholdPx = 30,
): PressablePin | null {
  const p = projectToPixels(press.lng, press.lat, zoom);
  let best: PressablePin | null = null;
  let bestDist = thresholdPx;
  for (const pin of pins) {
    const q = projectToPixels(pin.lng, pin.lat, zoom);
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (dist <= bestDist) {
      best = pin;
      bestDist = dist;
    }
  }
  return best;
}
