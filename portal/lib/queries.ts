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
