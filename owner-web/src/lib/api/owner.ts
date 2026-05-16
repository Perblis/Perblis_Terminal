import { apiClient } from "./client";

export type DashboardStats = {
  total_listings: number;
  active_listings: number;
  pending_booking_requests: number;
  active_bookings: number;
  unread_messages: number;
  /** Decimal string from the Django serializer, e.g. "45250.00". */
  revenue_this_month: string;
};

export type DashboardPendingRequest = {
  id: string;
  listing_id: string;
  listing_title: string;
  renter_name: string;
  renter_photo: string | null;
  start_date: string;
  end_date: string;
  gross_amount: string;
  created_at: string;
};

export type DashboardRecentMessage = {
  id: string;
  other_participant_name: string;
  other_participant_photo: string | null;
  listing_title: string;
  /** Null for newly-created threads that have no messages yet. */
  last_message_body: string | null;
  last_message_time: string | null;
  unread_count: number;
};

export type DashboardData = {
  stats: DashboardStats;
  pending_requests: DashboardPendingRequest[];
  recent_messages: DashboardRecentMessage[];
};

export const ownerApi = {
  dashboard: () => apiClient.get<{ success: true; data: DashboardData }>("/owner/dashboard/"),
};

export type RevenuePeriod = "month" | "quarter" | "year" | "all";

export type RevenueByListing = {
  listing_id: string;
  listing_title: string;
  resource_type: string;
  gross_total: string;
  commission_total: string;
  payout_total: string;
  booking_count: number;
};

export type RevenueTrendPoint = {
  year: number;
  month: number;
  month_label: string;
  gross_total: string;
  booking_count: number;
};

export type RevenueData = {
  gross_total: string;
  commission_total: string;
  payout_total: string;
  booking_count: number;
  avg_booking_value: string;
  by_listing: RevenueByListing[];
  monthly_trend: RevenueTrendPoint[];
};

export type PerformancePeriod = "last_30_days" | "last_90_days" | "last_year" | "all";

export type PerformanceByListing = {
  listing_id: string;
  listing_title: string;
  resource_type: string;
  status: string;
  views: number;
  inquiry_count: number;
  booking_request_count: number;
  confirmed_booking_count: number;
  occupancy_rate: number;
  conversion_rate: number;
};

export type PerformanceData = {
  total_views: number;
  total_inquiries: number;
  total_booking_requests: number;
  total_confirmed: number;
  overall_conversion_rate: number;
  by_listing: PerformanceByListing[];
};

export type BusinessProfile = {
  id: string;
  business_name: string | null;
  business_description: string | null;
  business_logo: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  notify_new_booking_request: boolean;
  notify_booking_confirmed: boolean;
  notify_new_message: boolean;
  notify_booking_cancelled: boolean;
  created_at: string;
  updated_at: string;
};

export const ownerAnalyticsApi = {
  revenue: (period: RevenuePeriod, year?: number, month?: number) =>
    apiClient.get<{ success: true; period: string; period_label: string; data: RevenueData }>(
      "/owner/analytics/revenue/",
      { query: { period, year, month } },
    ),

  performance: (period: PerformancePeriod) =>
    apiClient.get<{ success: true; period: string; period_label: string; data: PerformanceData }>(
      "/owner/analytics/performance/",
      { query: { period } },
    ),
};

export const ownerSettingsApi = {
  getProfile: () =>
    apiClient.get<{ success: true; data: BusinessProfile }>("/owner/business-profile/"),

  patchProfile: (body: FormData | Partial<BusinessProfile>) =>
    body instanceof FormData
      ? apiClient.patch<{ success: true; data: BusinessProfile }>("/owner/business-profile/", body)
      : apiClient.patch<{ success: true; data: BusinessProfile }>(
          "/owner/business-profile/",
          body,
        ),

  getBank: () =>
    apiClient.get<{
      success: true;
      data: Pick<BusinessProfile, "bank_name" | "bank_account_number" | "bank_account_name">;
    }>("/owner/bank-account/"),

  patchBank: (body: {
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
  }) => apiClient.patch<{ success: true; data: BusinessProfile }>("/owner/bank-account/", body),

  getNotifications: () =>
    apiClient.get<{
      success: true;
      data: Pick<
        BusinessProfile,
        | "notify_new_booking_request"
        | "notify_booking_confirmed"
        | "notify_new_message"
        | "notify_booking_cancelled"
      >;
    }>("/owner/notifications/"),

  patchNotifications: (
    body: Partial<
      Pick<
        BusinessProfile,
        | "notify_new_booking_request"
        | "notify_booking_confirmed"
        | "notify_new_message"
        | "notify_booking_cancelled"
      >
    >,
  ) => apiClient.patch<{ success: true; data: BusinessProfile }>("/owner/notifications/", body),
};
