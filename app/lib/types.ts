// Copied from portal/lib/types.ts (Wave 7) — keep in sync by copy, not import;
// the portal stays untouched by app changes (design.md §7 wave isolation).
// API shapes, mirrored from the DRF serializers (contract-first — the
// OpenAPI schema at backend/openapi/schema.yml is the source of truth).

export type Me = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_supplier: boolean;
  is_hirer: boolean;
  account_level: "basic" | "verified" | "business_verified";
  is_phone_verified: boolean;
  is_email_verified: boolean;
  is_verified: boolean;
};

export type SupplierProfile = {
  id: string;
  business_name: string;
  description: string;
  logo_key: string | null;
  logo_url: string | null;
  bank_name: string;
  bank_account_number_masked: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type GeoPoint = { type: "Point"; coordinates: [number, number] };

export type Yard = {
  id: string;
  name: string;
  point: GeoPoint;
  address_text: string;
  city: string;
  created_at: string;
  updated_at: string;
};

export type AssetClass =
  | "plant_machinery"
  | "trucks_haulage"
  | "warehousing"
  | "terminals_yards"
  | "land_staging";

/** listings/spec_data.py field def: keyed by spec key in the template dict. */
export type SpecField = {
  kind: "number" | "text" | "select" | "multi" | "boolean";
  required: boolean;
  filterable: boolean;
  display_name: string;
  unit?: string;
  options?: string[];
};

export type SpecTemplate = {
  asset_class: AssetClass;
  asset_type: string;
  version: number;
  fields: Record<string, SpecField>;
};

export type ListingStatus = "draft" | "live" | "paused" | "archived" | "removed";

export type ListingPhoto = {
  id: string;
  r2_key: string;
  url: string;
  position: number;
  is_cover: boolean;
};

export type Listing = {
  id: string;
  supplier_id: string;
  yard_id: string | null;
  asset_class: AssetClass;
  asset_type: string;
  title: string;
  description: string;
  specs: Record<string, unknown>;
  spec_template_version: number | null;
  daily_price: number; // integer kobo
  weekly_price: number | null;
  monthly_price: number | null;
  daily_price_display: string | null;
  weekly_price_display: string | null;
  monthly_price_display: string | null;
  unit_count: number;
  units: { id: string; label: string }[];
  photos: ListingPhoto[];
  point: GeoPoint | null;
  address_text: string;
  city: string;
  status: ListingStatus;
  tier: "basic" | "verified" | "inspected";
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  results: T[];
  next: string | null;
  previous?: string | null;
};

export type PayoutSummary = {
  queued_total: number;
  queued_total_display: string;
  frozen_total: number;
  frozen_total_display: string;
  earned_this_month: number;
  earned_this_month_display: string;
  earned_prev_month: number;
  earned_prev_month_display: string;
  last_paid: {
    amount: number;
    amount_display: string;
    paid_ref: string;
    paid_at: string;
  } | null;
};

export type HireStats = {
  by_status: Record<string, number>;
  needs_response: number;
  nearest_request_expires_at: string | null;
};

export type HireEvent = {
  id: string;
  hire_id: string;
  listing_title?: string;
  actor?: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
};

export type PresignResult = {
  key: string;
  bucket: string;
  presigned_put_url: string;
  expires_in: number;
};

export type GeocodeResult = {
  display_name: string;
  lat: number;
  lng: number;
};

export type GeocodeResponse = {
  query: string;
  provider_configured: boolean;
  results: GeocodeResult[];
};

export type HireStatus7 =
  | "requested"
  | "accepted"
  | "confirmed"
  | "on_hire"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled"
  | "in_dispute";

export type Hire = {
  id: string;
  listing_id: string;
  listing_title: string;
  asset_class: AssetClass;
  yard_id: string | null;
  listing_photo: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  scheme: string;
  status: HireStatus7;
  hire_value: number;
  hire_value_display: string;
  // Supplier-only (D-014) — absent on hirer-shaped responses.
  service_fee?: number;
  service_fee_display?: string;
  payout_amount?: number;
  payout_amount_display?: string;
  fee_basis?: string;
  cancelled_by: string | null;
  decline_reason: string;
  cancel_reason: string;
  hirer_note: string;
  request_expires_at: string | null;
  payment_deadline: string | null;
  created_at: string;
};

export type HireDetail = Hire & {
  events: {
    id: string;
    actor_kind: string;
    from_status: string | null;
    to_status: string;
    meta: Record<string, unknown>;
    created_at: string;
  }[];
};

export type RefundPreview = {
  cancelled_by: string;
  kind: string;
  hire_value: number;
  hire_value_display: string;
  amount: number;
  amount_display: string;
  withheld_day: number;
  withheld_day_display: string;
  processing: number;
  processing_display: string;
  strike: boolean;
};

export type HandoverRecord = {
  id: string;
  hire: string;
  kind: "on_hire" | "off_hire";
  photos: string[];
  reading: Record<string, unknown>;
  confirmed_at: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  kind: "enquiry" | "hire";
  counterparty: { id: string; name: string; verified: boolean };
  listing: { id: string; title: string; thumb_url: string | null } | null;
  yard_name: string | null;
  last_message_preview: string;
  last_message_at: string | null;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  masked: boolean;
  sent_at: string;
  read_at: string | null;
};
