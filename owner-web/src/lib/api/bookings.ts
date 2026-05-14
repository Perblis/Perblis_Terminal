import { apiClient } from "./client";
import type { BookingStatus } from "@/lib/constants";

export type BookingParty = {
  id: string;
  full_name: string;
  profile_photo: string | null;
  phone: string;
};

export type Booking = {
  id: string;
  renter: BookingParty;
  owner: BookingParty;
  listing_id: string;
  listing_title: string;
  start_date: string;
  end_date: string;
  duration_type: "daily" | "weekly" | "monthly";
  duration_days: number;
  gross_amount: string;
  commission_amount: string;
  owner_payout_amount: string;
  commission_rate: string;
  status: BookingStatus;
  payment_status: "unpaid" | "simulated_paid";
  renter_note: string | null;
  cancellation_reason: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Booking[];
};

export type CalendarListing = {
  id: string;
  title: string;
  resource_type: string;
  bookings: {
    id: string;
    start_date: string;
    end_date: string;
    status: BookingStatus;
    renter_name: string;
    gross_amount: string;
  }[];
};

export const bookingsApi = {
  list: (filters: { status?: BookingStatus; listing_id?: string; page?: number } = {}) =>
    apiClient.get<BookingListResponse>("/bookings/", {
      query: {
        role: "owner",
        ...filters,
      } as Record<string, string | number | boolean | undefined | null>,
    }),

  get: (id: string) =>
    apiClient
      .get<{ success: true; data: Booking }>(`/bookings/${id}/`)
      .then((r) => r.data),

  accept: (id: string) =>
    apiClient
      .patch<{ success: true; data: Booking }>(`/bookings/${id}/accept/`)
      .then((r) => r.data),

  decline: (id: string, reason?: string) =>
    apiClient
      .patch<{ success: true; data: Booking }>(`/bookings/${id}/decline/`, { reason })
      .then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    apiClient
      .patch<{ success: true; data: Booking }>(`/bookings/${id}/cancel/`, { reason })
      .then((r) => r.data),

  pay: (id: string) =>
    apiClient
      .patch<{ success: true; data: Booking }>(`/bookings/${id}/pay/`)
      .then((r) => r.data),

  calendar: (start_date: string, end_date: string) =>
    apiClient.get<{
      success: true;
      start_date: string;
      end_date: string;
      listing_count: number;
      data: CalendarListing[];
    }>("/owner/bookings/calendar/", { query: { start_date, end_date } }),
};
