// TanStack Query hooks over the frozen API contracts. Key families listed
// in the persister allowlist (components/shell/query-provider.tsx) persist
// to MMKV; search/map families deliberately do not.
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
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
  Hire,
  HandoverRecord,
  ListAssetItem,
  ListLocationListing,
  ListLocationYard,
  ListSearchPage,
  Listing,
  HireDetail,
  MapResponse,
  PaymentStatus,
  RefundPreview,
  SpecTemplate,
  Storefront,
} from "./types";


export const keys = {
  mapSearch: (query: string) => ["map-search", query] as const,
  specTemplate: (c: string, t: string, v: string) => ["spec-template", c, t, v] as const,
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

export const hireKeys = {
  all: ["hires"] as const,
  list: () => ["hires", "list"] as const,
  detail: (id: string) => ["hire", id] as const,
  handovers: (id: string) => ["hire-handovers", id] as const,
  refundPreview: (id: string) => ["refund-preview", id] as const,
  payment: (id: string) => ["payment", id] as const,
};

type HirePage = { next: string | null; results: Hire[] };

/** S9 My Hires: every hire the caller is party to (walks all cursor pages),
 *  partitioned into tabs client-side. Persisted (["hires"]) so it renders cold. */
export function useHires() {
  return useQuery({
    queryKey: hireKeys.list(),
    queryFn: async () => {
      const all: Hire[] = [];
      let path: string | null = "/hires?role=hirer";
      while (path) {
        const page: HirePage = await apiFetch<HirePage>(path);
        all.push(...page.results);
        const qs = page.next ? page.next.split("?")[1] : null;
        path = qs ? `/hires?${qs}` : null;
      }
      return all;
    },
  });
}

/** S8/S10: pass refetchInterval to poll (webhook is truth — never the redirect). */
export function useHire(id: string | null, refetchInterval?: number) {
  return useQuery({
    queryKey: hireKeys.detail(id ?? "none"),
    queryFn: () => apiFetch<HireDetail>(`/hires/${id}`),
    enabled: id !== null,
    refetchInterval,
  });
}

/** S10: the hire's handover records (bare array; ≤2). */
export function useHandovers(hireId: string | null) {
  return useQuery({
    queryKey: hireKeys.handovers(hireId ?? "none"),
    queryFn: () => apiFetch<HandoverRecord[]>(`/hires/${hireId}/handovers`),
    enabled: hireId !== null,
  });
}

export type SubmitHandoverPayload = {
  kind: "on_hire" | "off_hire";
  photos: string[];
  reading?: Record<string, unknown>;
};

/** S11: submit an on-hire/off-hire record. The counterparty confirms it. */
export function useSubmitHandover(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitHandoverPayload) =>
      apiFetch<HandoverRecord>(`/hires/${hireId}/handovers`, { method: "POST", body: payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireKeys.handovers(hireId) });
      void qc.invalidateQueries({ queryKey: hireKeys.detail(hireId) });
    },
  });
}

/** S10/S11: confirm the counterparty's record — advances the hire's state. */
export function useConfirmHandover(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (handoverId: string) =>
      apiFetch<HandoverRecord>(`/handovers/${handoverId}/confirm`, { method: "POST", body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireKeys.handovers(hireId) });
      void qc.invalidateQueries({ queryKey: hireKeys.detail(hireId) });
      void qc.invalidateQueries({ queryKey: hireKeys.all });
    },
  });
}

/** S10 Raise issue → In Dispute (server enforces the on_hire / ≤72h window). */
export function useRaiseDispute(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch<HireDetail>(`/hires/${hireId}/dispute`, { method: "POST", body: { reason } }),
    onSuccess: (hire) => {
      qc.setQueryData(hireKeys.detail(hireId), hire);
      void qc.invalidateQueries({ queryKey: hireKeys.all });
    },
  });
}

export type CreateHirePayload = {
  listing_id: string;
  start_date: string;
  end_date: string;
  hirer_note?: string;
  terms_accepted: true;
};

export function useCreateHire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHirePayload) =>
      apiFetch<HireDetail>("/hires", { method: "POST", body: payload }),
    onSuccess: (hire) => {
      qc.setQueryData(hireKeys.detail(hire.id), hire);
      void qc.invalidateQueries({ queryKey: hireKeys.all });
    },
  });
}

export function useCancelHire(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch<HireDetail>(`/hires/${id}/cancel`, { method: "POST", body: { reason } }),
    onSuccess: (hire) => {
      qc.setQueryData(hireKeys.detail(id), hire);
      void qc.invalidateQueries({ queryKey: hireKeys.all });
    },
  });
}

/** Confirmed hires only — 400 refund_not_applicable otherwise. */
export function useRefundPreview(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: hireKeys.refundPreview(id ?? "none"),
    queryFn: () => apiFetch<RefundPreview>(`/hires/${id}/refund-preview`),
    enabled: enabled && id !== null,
  });
}

/** Lazily (re)initializes checkout for an accepted hire on the server. */
export function usePaymentStatus(id: string | null, refetchInterval?: number) {
  return useQuery({
    queryKey: hireKeys.payment(id ?? "none"),
    queryFn: () => apiFetch<PaymentStatus>(`/hires/${id}/payment`),
    enabled: id !== null,
    refetchInterval,
    retry: false, // 404 no_payment / 503 checkout_unavailable surface immediately
  });
}

/** S6 SpecTable: the versioned template the listing's specs were written against. */
export function useSpecTemplate(
  assetClass: string | null,
  assetType: string | null,
  version: number | null,
) {
  const enabled = assetClass !== null && assetType !== null;
  const params = new URLSearchParams();
  if (assetClass) params.set("class", assetClass);
  if (assetType) params.set("type", assetType);
  if (version !== null) params.set("version", String(version));
  return useQuery({
    queryKey: keys.specTemplate(assetClass ?? "", assetType ?? "", String(version ?? "")),
    queryFn: () => apiFetch<SpecTemplate>(`/spec-templates?${params.toString()}`),
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // templates are versioned — effectively immutable
  });
}
