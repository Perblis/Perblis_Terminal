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
