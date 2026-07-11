"use client";

// TanStack Query hooks — all server state lives here (design.md §5). Every
// call rides the BFF; keys are stable arrays for targeted invalidation.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { bff } from "./api";
import type {
  GeocodeResponse,
  HireEvent,
  HireStats,
  Listing,
  Me,
  Paginated,
  PayoutSummary,
  SpecTemplate,
  SupplierProfile,
  Yard,
} from "./types";

export const keys = {
  me: ["me"] as const,
  profile: ["supplier-profile"] as const,
  yards: ["yards"] as const,
  listings: ["listings"] as const,
  template: (cls: string, type: string) => ["spec-template", cls, type] as const,
  hireStats: ["hire-stats"] as const,
  hireEvents: ["hire-events"] as const,
  payouts: ["payouts"] as const,
};

export function useMe(options?: Partial<UseQueryOptions<Me>>) {
  return useQuery({ queryKey: keys.me, queryFn: () => bff<Me>("/me"), ...options });
}

export function useSupplierProfile(enabled = true) {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => bff<SupplierProfile>("/suppliers/me/profile"),
    enabled,
    retry: false,
  });
}

export function useYards() {
  return useQuery({
    queryKey: keys.yards,
    queryFn: () => bff<Paginated<Yard>>("/yards"),
    select: (data) => data.results,
  });
}

/** The supplier's whole fleet — follows cursor pages to the end (P3 filters client-side). */
export function useListings() {
  return useQuery({
    queryKey: keys.listings,
    queryFn: async () => {
      const all: Listing[] = [];
      let path: string | null = "/listings";
      while (path) {
        const page: Paginated<Listing> = await bff<Paginated<Listing>>(path);
        all.push(...page.results);
        path = page.next ? `/listings?${page.next.split("?")[1] ?? ""}` : null;
        if (all.length > 2000) break; // runaway guard; MVP fleets are far smaller
      }
      return all;
    },
  });
}

export function useSpecTemplate(assetClass: string, assetType: string) {
  return useQuery({
    queryKey: keys.template(assetClass, assetType),
    queryFn: () =>
      bff<SpecTemplate>(
        `/spec-templates?class=${encodeURIComponent(assetClass)}&type=${encodeURIComponent(assetType)}`,
      ),
    enabled: Boolean(assetClass && assetType),
    staleTime: Infinity, // versioned + immutable per version
  });
}

export function useHireStats() {
  return useQuery({
    queryKey: keys.hireStats,
    queryFn: () => bff<HireStats>("/hires/stats"),
    refetchInterval: 60_000,
  });
}

export function useHireEvents() {
  return useQuery({
    queryKey: keys.hireEvents,
    queryFn: () => bff<Paginated<HireEvent>>("/hires/events"),
    select: (data) => data.results,
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: keys.payouts,
    queryFn: () => bff<Paginated<Payout> & { summary: PayoutSummary }>("/payments/payouts"),
  });
}

export type Payout = {
  id: string;
  hire_id: string;
  listing_title: string;
  amount: number;
  amount_display: string;
  state: string;
  kind: string;
  paid_ref: string;
  paid_at: string | null;
  created_at: string;
};

export function geocode(q: string): Promise<GeocodeResponse> {
  return bff<GeocodeResponse>(`/geocode?q=${encodeURIComponent(q)}`);
}

// --- mutations ---------------------------------------------------------------

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keyList: readonly (readonly unknown[])[]) =>
    Promise.all(keyList.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useCreateYard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string; point: unknown; address_text?: string; city?: string }) =>
      bff<Yard>("/yards", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidate(keys.yards),
  });
}

export function useUpdateYard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Omit<Yard, "id">>) =>
      bff<Yard>(`/yards/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => invalidate(keys.yards, keys.listings),
  });
}

export function useDeleteYard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => bff<void>(`/yards/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(keys.yards),
  });
}

export function useActivateSupplier() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => bff<Me>("/me/activate-supplier", { method: "POST" }),
    onSuccess: () => invalidate(keys.me),
  });
}

export function useListingMutation(action: "publish" | "pause" | "archive" | "duplicate") {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      bff<Listing>(`/listings/${id}/${action}`, { method: "POST" }),
    onSuccess: () => invalidate(keys.listings),
  });
}

// --- hires (7C) ---------------------------------------------------------------

import type { Hire, HireDetail, RefundPreview, HandoverRecord } from "./types";

export const hireKeys = {
  list: (params: string) => ["hires", params] as const,
  detail: (id: string) => ["hire", id] as const,
  refundPreview: (id: string) => ["hire-refund-preview", id] as const,
  handovers: (id: string) => ["hire-handovers", id] as const,
};

/** Supplier hires, following cursor pages (P6/P8 slice client-side). */
export function useHires(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams({ role: "supplier", ...params }).toString();
  return useQuery({
    queryKey: hireKeys.list(qs),
    queryFn: async () => {
      const all: Hire[] = [];
      let path: string | null = `/hires?${qs}`;
      while (path) {
        const page: Paginated<Hire> = await bff<Paginated<Hire>>(path);
        all.push(...page.results);
        path = page.next ? `/hires?${page.next.split("?")[1] ?? ""}` : null;
        if (all.length > 2000) break;
      }
      return all;
    },
    refetchInterval: 60_000,
  });
}

export function useHire(id: string) {
  return useQuery({
    queryKey: hireKeys.detail(id),
    queryFn: () => bff<HireDetail>(`/hires/${id}`),
    refetchInterval: 30_000,
  });
}

export function useRefundPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: hireKeys.refundPreview(id),
    queryFn: () => bff<RefundPreview>(`/hires/${id}/refund-preview`),
    enabled,
    retry: false,
  });
}

export function useHandovers(id: string) {
  return useQuery({
    queryKey: hireKeys.handovers(id),
    queryFn: () => bff<Paginated<HandoverRecord> | HandoverRecord[]>(`/hires/${id}/handovers`),
    select: (d) => (Array.isArray(d) ? d : d.results),
  });
}

export function useHireAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: "accept" | "decline" | "cancel" | "dispute"; body?: unknown }) =>
      bff<HireDetail>(`/hires/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ["hires"] });
      void qc.invalidateQueries({ queryKey: keys.hireStats });
      void qc.invalidateQueries({ queryKey: keys.hireEvents });
    },
  });
}

export function useConfirmHandover(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (handoverId: string) =>
      bff<HandoverRecord>(`/handovers/${handoverId}/confirm`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireKeys.handovers(hireId) });
      void qc.invalidateQueries({ queryKey: hireKeys.detail(hireId) });
      void qc.invalidateQueries({ queryKey: ["hires"] });
    },
  });
}

export function useSubmitHandover(hireId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: "on_hire" | "off_hire"; photos: string[]; reading: Record<string, unknown> }) =>
      bff<HandoverRecord>(`/hires/${hireId}/handovers`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireKeys.handovers(hireId) });
      void qc.invalidateQueries({ queryKey: hireKeys.detail(hireId) });
      void qc.invalidateQueries({ queryKey: ["hires"] });
    },
  });
}
