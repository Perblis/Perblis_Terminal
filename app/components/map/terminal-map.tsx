// The ONE module that imports @maplibre/maplibre-react-native (test/mock
// seam). Renders the Terminal Chart (D-022 grade over Liberty), yard pins
// (never clustered), supercluster'd solo pins, and the V5 feel: spring pin
// drops, crosshair select ring, haptic tick; first-launch staggered reveal.
import {
  Camera,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import * as Haptics from "expo-haptics";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, useColorScheme, type NativeSyntheticEvent } from "react-native";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";

import { getSoloFeatures, buildSoloIndex, type SoloFeature } from "../../lib/cluster";
import { LIBERTY_URL, getTerminalChartStyle, type TerminalChartStyle } from "../../lib/map-style";
import type { Bbox } from "../../lib/search-params";
import type { MapSoloListing, MapYard } from "../../lib/types";
import { AssetPin, ClusterPin, CrosshairRing, YardPin } from "./pins";

export type MapSelection =
  | { kind: "yard"; yard: MapYard }
  | { kind: "listing"; listing: MapSoloListing }
  | null;

export type TerminalMapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
};

type Props = {
  initialCenter: [number, number];
  initialZoom: number;
  yards: MapYard[];
  solos: MapSoloListing[];
  filtered: boolean;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
  /** Fired on every settle; the parent owns the fetch debounce. */
  onRegionChanged: (bbox: Bbox, zoom: number, center: [number, number]) => void;
  onMapError?: () => void;
  /** First-launch reveal (V7④) — staggered pin drops; parent flips it off after. */
  reveal?: boolean;
  /** Cap on rendered items — ">200 ⇒ zoom in" is the parent's chip. */
  renderCap?: number;
};

export const TerminalMap = forwardRef<TerminalMapHandle, Props>(function TerminalMap(
  {
    initialCenter,
    initialZoom,
    yards,
    solos,
    filtered,
    selection,
    onSelect,
    onRegionChanged,
    onMapError,
    reveal = false,
    renderCap = 200,
  },
  ref,
) {
  const scheme = useColorScheme();
  const reducedMotion = useReducedMotion();
  const cameraRef = useRef<CameraRef>(null);
  const [style, setStyle] = useState<TerminalChartStyle | null>(null);
  const [viewport, setViewport] = useState<{ bbox: Bbox; zoom: number } | null>(null);

  const theme = scheme === "dark" ? "dark" : "light";
  useEffect(() => {
    let live = true;
    void getTerminalChartStyle(theme).then((s) => {
      if (live) setStyle(s);
    });
    return () => {
      live = false;
    };
  }, [theme]);

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom) => {
      cameraRef.current?.flyTo({
        center: [lng, lat],
        zoom,
        duration: reducedMotion ? 0 : 600,
      });
    },
  }));

  const select = (next: MapSelection) => {
    if (next) void Haptics.selectionAsync().catch(() => {});
    onSelect(next);
  };

  const handleRegionChange = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { bounds, zoom, center } = e.nativeEvent;
    const [west, south, east, north] = bounds;
    const bbox: Bbox = { minLng: west, minLat: south, maxLng: east, maxLat: north };
    setViewport({ bbox, zoom });
    onRegionChanged(bbox, zoom, center);
  };

  const soloFeatures: SoloFeature[] =
    viewport && solos.length > 0
      ? getSoloFeatures(buildSoloIndex(solos), viewport.bbox, viewport.zoom)
      : solos.map((l) => ({
          kind: "solo" as const,
          listing: l,
          lng: l.point.coordinates[0],
          lat: l.point.coordinates[1],
        }));

  const entering = (index: number) =>
    reducedMotion
      ? undefined
      : ZoomIn.springify().damping(14).delay(reveal ? Math.min(index, 20) * 40 : 0);

  const shown = soloFeatures.slice(0, renderCap);

  return (
    <MapLibreMap
      style={{ flex: 1 }}
      mapStyle={(style ?? LIBERTY_URL) as string | StyleSpecification}
      attribution
      attributionPosition={{ bottom: 8, left: 8 }}
      logo={false}
      onDidFailLoadingMap={onMapError}
      onRegionDidChange={handleRegionChange}
      onPress={() => onSelect(null)}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: initialCenter, zoom: initialZoom }}
      />

      {/* Yard pins — never clustered, never dissolve (FSD §6). */}
      {yards.map((yard, i) => {
        const [lng, lat] = yard.point.coordinates;
        const isSelected = selection?.kind === "yard" && selection.yard.yard_id === yard.yard_id;
        return (
          <Marker
            key={yard.yard_id}
            lngLat={[lng, lat]}
            anchor="bottom"
            onPress={() => select({ kind: "yard", yard })}
          >
            <Animated.View entering={entering(i)}>
              {isSelected ? (
                <View style={{ position: "absolute", left: -4, top: 0 }} pointerEvents="none">
                  <CrosshairRing size={60} />
                </View>
              ) : null}
              <YardPin yard={yard} filtered={filtered} selected={isSelected} />
            </Animated.View>
          </Marker>
        );
      })}

      {/* Solo pins + drab spatial clusters (dissolve on zoom). */}
      {shown.map((f, i) => {
        if (f.kind === "cluster") {
          return (
            <Marker
              key={`c-${f.id}`}
              lngLat={[f.lng, f.lat]}
              anchor="center"
              onPress={() =>
                cameraRef.current?.easeTo({
                  center: [f.lng, f.lat],
                  zoom: f.expansionZoom,
                  duration: reducedMotion ? 0 : 450,
                })
              }
            >
              <Animated.View entering={entering(yards.length + i)}>
                <ClusterPin count={f.count} />
              </Animated.View>
            </Marker>
          );
        }
        const isSelected = selection?.kind === "listing" && selection.listing.id === f.listing.id;
        return (
          <Marker
            key={f.listing.id}
            lngLat={[f.lng, f.lat]}
            anchor="bottom"
            onPress={() => select({ kind: "listing", listing: f.listing })}
          >
            <Animated.View entering={entering(yards.length + i)}>
              {isSelected ? (
                <View style={{ position: "absolute", left: -10, top: -6 }} pointerEvents="none">
                  <CrosshairRing size={58} />
                </View>
              ) : null}
              <AssetPin listing={f.listing} selected={isSelected} />
            </Animated.View>
          </Marker>
        );
      })}
    </MapLibreMap>
  );
});

/**
 * S6 privacy mini-map: non-interactive chart with a ~200m amber radius —
 * never the exact pin until Confirmed (FSD §6 privacy posture). Lives here
 * to keep this file the sole maplibre importer.
 */
export function StaticMiniMap({ lng, lat, height = 160 }: { lng: number; lat: number; height?: number }) {
  const scheme = useColorScheme();
  const [style, setStyle] = useState<TerminalChartStyle | null>(null);
  const theme = scheme === "dark" ? "dark" : "light";

  useEffect(() => {
    let live = true;
    void getTerminalChartStyle(theme).then((s) => {
      if (live) setStyle(s);
    });
    return () => {
      live = false;
    };
  }, [theme]);

  return (
    <View style={{ height, borderRadius: 8, overflow: "hidden" }} pointerEvents="none">
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={(style ?? LIBERTY_URL) as string | StyleSpecification}
        attribution={false}
        logo={false}
      >
        <Camera initialViewState={{ center: [lng, lat], zoom: 13.5 }} />
        <Marker lngLat={[lng, lat]} anchor="center">
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "rgba(245,158,11,0.25)",
              borderWidth: 1.5,
              borderColor: "#F59E0B",
            }}
          />
        </Marker>
      </MapLibreMap>
    </View>
  );
}
