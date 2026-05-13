export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const API_PREFIX = "/api/v1";

export const RESOURCE_TYPES = [
  "equipment",
  "vehicle",
  "warehouse",
  "terminal",
  "facility",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const LISTING_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "declined",
  "active",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const QUERY_KEYS = {
  me: ["me"] as const,
  dashboard: ["owner", "dashboard"] as const,
  businessProfile: ["owner", "business-profile"] as const,
  bankAccount: ["owner", "bank-account"] as const,
  notifications: ["owner", "notifications"] as const,
  listings: (filters?: Record<string, unknown>) => ["listings", filters ?? {}] as const,
  listing: (id: string) => ["listing", id] as const,
  listingStats: (id: string) => ["listing", id, "stats"] as const,
  bookings: (filters?: Record<string, unknown>) => ["bookings", filters ?? {}] as const,
  booking: (id: string) => ["booking", id] as const,
  calendar: (start: string, end: string) => ["owner", "calendar", start, end] as const,
  threads: ["threads"] as const,
  thread: (id: string) => ["thread", id] as const,
  revenue: (period: string, year?: number, month?: number) =>
    ["owner", "analytics", "revenue", period, year, month] as const,
  performance: (period: string) => ["owner", "analytics", "performance", period] as const,
};
