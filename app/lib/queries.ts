// TanStack Query hooks over the frozen API contracts. Key families listed
// in the persister allowlist (components/shell/query-provider.tsx) persist
// to MMKV; search/map families deliberately do not.
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import { apiFetch } from "./api";
import {
  isValidBbox,
  listSearchQuery,
  mapSearchQuery,
  type Bbox,
  type RadiusArea,
  type SearchFilters,
} from "./search-params";
import type {
  GeocodeResponse,
  ListAssetItem,
  ListLocationListing,
  ListLocationYard,
  ListSearchPage,
  Listing,
  MapResponse,
  Storefront,
} from "./types";

export const keys = {
  mapSearch: (query: string) => ["map-search", query] as const,
  listSearch: (query: string) => ["list-search", query] as const,
  listing: (id: string) => ["listing", id] as const,
  storefront: (id: string) => ["storefront", id] as const,
  geocode: (q: string) => ["geocode", q] as const,
};

/** S4: viewport search — previous pins stay while the next viewport loads. */
export function useMapSearch(bbox: Bbox, filters: SearchFilters) {
  const query = isValidBbox(bbox) ? mapSearchQuery(bbox, filters) : null;
  return useQuery({
    queryKey: keys.mapSearch(query ?? "invalid"),
    queryFn: () => apiFetch<MapResponse>(`/search/map?${query}`),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export type ListRow = ListAssetItem | ListLocationYard | ListLocationListing;

/** S12: keyset-cursor infinite list. */
export function useListSearch(
  area: RadiusArea,
  filters: SearchFilters,
  groupBy: "asset" | "location",
  enabled = true,
) {
  const query = listSearchQuery(area, filters, groupBy);
  return useInfiniteQuery({
    queryKey: keys.listSearch(query),
    queryFn: ({ pageParam }) =>
      apiFetch<ListSearchPage<ListRow>>(
        pageParam ? `/search/list?${pageParam}` : `/search/list?${query}`,
      ),
    initialPageParam: null as string | null,
    // `next` is an absolute URL; keep only its query string.
    getNextPageParam: (last) => (last.next ? (last.next.split("?")[1] ?? null) : null),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: string | null) {
  return useQuery({
    queryKey: keys.listing(id ?? "none"),
    queryFn: () => apiFetch<Listing>(`/listings/${id}`),
    enabled: id !== null,
  });
}

export function useStorefront(supplierId: string | null) {
  return useQuery({
    queryKey: keys.storefront(supplierId ?? "none"),
    queryFn: () => apiFetch<Storefront>(`/storefronts/${supplierId}`),
    enabled: supplierId !== null,
  });
}

/** Keyless-degraded server-side LocationIQ proxy (empty results, never errors). */
export function useGeocode(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: keys.geocode(trimmed),
    queryFn: () => apiFetch<GeocodeResponse>(`/geocode?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    staleTime: 24 * 60 * 60 * 1000, // server caches 24h too
  });
}
