// Query-string builders for the frozen Wave 3 search contracts.
// bbox XOR radius; spec bounds require a class; prices are integer kobo.
import type { AssetClass } from "./types";

export type SearchFilters = {
  assetClass?: AssetClass | null;
  q?: string;
  /** kobo (convert at the form edge with parseNairaInput) */
  priceMinKobo?: number | null;
  priceMaxKobo?: number | null;
  specMin?: number | null;
  specMax?: number | null;
  /** Hire window (both-or-neither — the server rejects one without the other);
   *  'available' then reflects the window instead of just today. */
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type Bbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type RadiusArea = { lat: number; lng: number; radiusKm: number };

function appendFilters(params: URLSearchParams, f: SearchFilters): void {
  if (f.assetClass) params.set("asset_class", f.assetClass);
  if (f.q?.trim()) params.set("q", f.q.trim());
  if (f.priceMinKobo != null) params.set("price_min", String(f.priceMinKobo));
  if (f.priceMaxKobo != null) params.set("price_max", String(f.priceMaxKobo));
  // Spec bounds are only valid with a class (server 400s otherwise).
  if (f.assetClass) {
    if (f.specMin != null) params.set("spec_min", String(f.specMin));
    if (f.specMax != null) params.set("spec_max", String(f.specMax));
  }
  // Dates go both-or-neither (server 400s a lone bound).
  if (f.dateFrom && f.dateTo) {
    params.set("date_from", f.dateFrom);
    params.set("date_to", f.dateTo);
  }
}

export function mapSearchQuery(bbox: Bbox, filters: SearchFilters): string {
  const params = new URLSearchParams();
  params.set(
    "bbox",
    [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].map((n) => n.toFixed(6)).join(","),
  );
  appendFilters(params, filters);
  return params.toString();
}

export function listSearchQuery(
  area: RadiusArea,
  filters: SearchFilters,
  groupBy: "asset" | "location",
  pageSize = 20,
): string {
  const params = new URLSearchParams();
  params.set("lat", area.lat.toFixed(6));
  params.set("lng", area.lng.toFixed(6));
  params.set("radius_km", String(area.radiusKm));
  appendFilters(params, filters);
  params.set("group_by", groupBy);
  params.set("page_size", String(pageSize));
  return params.toString();
}

/** A bbox is queryable when it is non-degenerate and sanely ordered. */
export function isValidBbox(b: Bbox): boolean {
  return (
    Number.isFinite(b.minLng) &&
    Number.isFinite(b.minLat) &&
    Number.isFinite(b.maxLng) &&
    Number.isFinite(b.maxLat) &&
    b.minLng < b.maxLng &&
    b.minLat < b.maxLat
  );
}
