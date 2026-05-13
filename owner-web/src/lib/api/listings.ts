import type { ListingStatus, ResourceType } from "@/lib/constants";

import { apiClient } from "./client";

export type ListingOwner = {
  id: string;
  full_name: string;
  profile_photo: string | null;
  verification_level: number | string;
};

export type ListingMedia = {
  id: string;
  file_url: string;
  is_primary: boolean;
  display_order?: number;
  created_at?: string;
};

export type Listing = {
  id: string;
  owner: ListingOwner;
  resource_type: ResourceType;
  title: string;
  description: string;
  category: string;
  price_daily: string | null;
  price_weekly: string | null;
  price_monthly: string | null;
  specs: Record<string, string | number | boolean>;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  location_city: string | null;
  status: ListingStatus;
  is_available: boolean;
  verification_tier: "basic" | "verified" | "inspected";
  view_count: number;
  operator_available: boolean;
  delivery_available: boolean;
  media: ListingMedia[];
  primary_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingFilters = {
  status?: ListingStatus;
  resource_type?: ResourceType;
  city?: string;
  is_available?: boolean;
  min_price_daily?: number;
  max_price_daily?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
};

export type ListingListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Listing[];
};

export type ListingCreatePayload = {
  resource_type: ResourceType;
  title: string;
  description: string;
  category?: string;
  price_daily?: number | string;
  price_weekly?: number | string;
  price_monthly?: number | string;
  specs?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  location_city?: string;
  operator_available?: boolean;
  delivery_available?: boolean;
};

export type ListingStats = {
  listing_id: string;
  view_count: number;
  inquiry_count: number;
  booking_request_count: number;
  confirmed_booking_count: number;
  conversion_rate: number;
  occupancy_rate_90d: number;
  total_gross_revenue: string;
  total_payout: string;
};

/**
 * Bulk action response. The backend returns one of two shapes:
 *
 *   pause / archive →  { success, message, updated_count }
 *   activate         →  { success, message, activated, skipped, skipped_reason, skipped_listings }
 *
 * where `activated` / `skipped` are NUMBERS, `skipped_reason` is a single
 * string, and `skipped_listings` is an array of LISTING TITLES.
 */
export type BulkActionResult = {
  success: true;
  message?: string;
  /** pause / archive */
  updated_count?: number;
  /** activate */
  activated?: number;
  /** activate */
  skipped?: number;
  /** activate — single reason string for all skipped */
  skipped_reason?: string;
  /** activate — list of skipped listing titles */
  skipped_listings?: string[];
};

type Wrapped<T> = { success: true; data: T };

export const listingsApi = {
  list: (filters: ListingFilters = {}) =>
    apiClient.get<ListingListResponse>("/listings/", {
      query: filters as Record<string, string | number | boolean | undefined | null>,
    }),

  get: async (id: string): Promise<Listing> => {
    const res = await apiClient.get<Wrapped<Listing>>(`/listings/${id}/`);
    return res.data;
  },

  create: async (body: ListingCreatePayload): Promise<Listing> => {
    const res = await apiClient.post<Wrapped<Listing>>("/listings/", body);
    return res.data;
  },

  patch: async (id: string, body: Partial<ListingCreatePayload>): Promise<Listing> => {
    const res = await apiClient.patch<Wrapped<Listing>>(`/listings/${id}/`, body);
    return res.data;
  },

  setStatus: (id: string, status: ListingStatus) =>
    apiClient.patch<{
      success: true;
      message?: string;
      data: { status: ListingStatus };
    }>(`/listings/${id}/status/`, { status }),

  archive: (id: string) =>
    apiClient.delete<{ success: true; message?: string }>(`/listings/${id}/`),

  uploadMedia: (id: string, file: File, is_primary = false) => {
    const fd = new FormData();
    fd.append("file", file);
    if (is_primary) fd.append("is_primary", "true");
    return apiClient.upload<{ success: true; data: ListingMedia }>(`/listings/${id}/media/`, fd);
  },

  deleteMedia: (listing_id: string, media_id: string) =>
    apiClient.delete<{ success: true; message?: string }>(
      `/listings/${listing_id}/media/${media_id}/`,
    ),

  stats: (id: string) => apiClient.get<Wrapped<ListingStats>>(`/owner/listings/${id}/stats/`),

  duplicate: async (id: string): Promise<Listing> => {
    const res = await apiClient.post<Wrapped<Listing>>(`/owner/listings/${id}/duplicate/`);
    return res.data;
  },

  bulk: (ids: string[], action: "activate" | "pause" | "archive") =>
    apiClient.post<BulkActionResult>("/owner/listings/bulk/", {
      ids,
      action,
    }),
};
