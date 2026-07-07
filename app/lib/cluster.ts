// Client-side spatial clustering over SOLO pins only — yard pins never
// cluster and never dissolve (FSD §6); clusters are "deliberately drab"
// spatial conveniences that dissolve on zoom (06 §3).
import Supercluster from "supercluster";

import type { Bbox } from "./search-params";
import type { MapSoloListing } from "./types";

export type SoloFeature =
  | { kind: "cluster"; id: number; count: number; lng: number; lat: number; expansionZoom: number }
  | { kind: "solo"; listing: MapSoloListing; lng: number; lat: number };

/** Clusters dissolve entirely past this zoom (street level). */
const MAX_CLUSTER_ZOOM = 15;

export function buildSoloIndex(listings: MapSoloListing[]) {
  const index = new Supercluster<{ listing: MapSoloListing }>({
    radius: 48,
    maxZoom: MAX_CLUSTER_ZOOM,
  });
  index.load(
    listings.map((listing) => ({
      type: "Feature" as const,
      geometry: listing.point,
      properties: { listing },
    })),
  );
  return index;
}

export function getSoloFeatures(
  index: ReturnType<typeof buildSoloIndex>,
  bbox: Bbox,
  zoom: number,
): SoloFeature[] {
  const raw = index.getClusters(
    [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat],
    Math.round(zoom),
  );
  return raw.map((f) => {
    const [lng, lat] = f.geometry.coordinates as [number, number];
    if (f.properties && "cluster" in f.properties && f.properties.cluster) {
      const id = f.id as number;
      return {
        kind: "cluster",
        id,
        count: (f.properties as { point_count: number }).point_count,
        lng,
        lat,
        expansionZoom: Math.min(index.getClusterExpansionZoom(id), MAX_CLUSTER_ZOOM + 1),
      };
    }
    return { kind: "solo", listing: (f.properties as { listing: MapSoloListing }).listing, lng, lat };
  });
}
