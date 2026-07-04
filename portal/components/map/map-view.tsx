"use client";

// MapLibre GL wrapper (D-013 — never Mapbox/Google). OpenFreeMap Liberty
// serves as the base until the "Terminal Chart" style JSON lands in
// packages/tokens/map (design-system 06 §3 deliverable, tracked for 7E).
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Lagos — the launch market (D-007). */
export const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244];

export function MapView({
  center,
  zoom = 11,
  marker,
  onPick,
  interactive = true,
  className,
}: {
  center?: [number, number];
  zoom?: number;
  /** [lng, lat] pin; draggable when onPick is provided. */
  marker?: [number, number] | null;
  /** Pin-drop correction (J1's failure-point fix): click or drag re-pins. */
  onPick?: (lngLat: [number, number]) => void;
  interactive?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: center ?? DEFAULT_CENTER,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    map.current = instance;
    // Interim "Terminal Chart" grade (06 §3) applied at runtime until the
    // full style JSON lands in packages/tokens/map: paper-tinted land,
    // desaturated water, ink roads, POI labels off at low zoom.
    instance.on("load", () => {
      const style = instance.getStyle();
      for (const layer of style.layers ?? []) {
        try {
          if (layer.type === "background") {
            instance.setPaintProperty(layer.id, "background-color", "#F7F7F5");
          } else if (layer.id.includes("water") && layer.type === "fill") {
            instance.setPaintProperty(layer.id, "fill-color", "#C6D2D9");
          } else if (layer.type === "symbol" && layer.id.includes("poi")) {
            instance.setLayoutProperty(layer.id, "visibility", "none");
          }
        } catch {
          // best-effort grading; unknown layers keep their Liberty defaults
        }
      }
    });
    if (interactive) {
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("click", (e) => {
        onPickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      });
    }
    return () => {
      pin.current = null;
      instance.remove();
      map.current = null;
    };
    // The map instance mounts once; center/marker updates flow via the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && center) {
      map.current.easeTo({ center, zoom: Math.max(map.current.getZoom(), 13), duration: 400 });
    }
  }, [center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!marker) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      const el = document.createElement("div");
      // AssetPin-adjacent: ink ring + amber fill teardrop stand-in.
      el.className = "size-s4 rounded-pill border-2 border-ink-900 bg-amber-500 shadow-e1";
      pin.current = new Marker({ element: el, draggable: Boolean(onPickRef.current) })
        .setLngLat(marker)
        .addTo(m);
      pin.current.on("dragend", () => {
        const pos = pin.current?.getLngLat();
        if (pos) onPickRef.current?.([pos.lng, pos.lat]);
      });
    } else {
      pin.current.setLngLat(marker);
    }
  }, [marker?.[0], marker?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={container} className={className} />;
}
