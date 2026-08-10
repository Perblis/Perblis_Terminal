// What a facility can actually do, read from the specs the supplier filled in.
//
// This is a CURATED PRESENTATION LAYER, not a mirror of
// backend/listings/spec_data.py (unlike lib/star-field.ts, which genuinely
// mirrors _STAR_FIELDS). Copying all ~90 field definitions would be drift
// surface for no gain, and the backend's own `display_name` is the wrong copy
// anyway: it says "Truck access", a hirer wants "Trailer access".
//
// Three rules make this honest, and they matter more than the ordering:
//
//   1. ABSENCE IS NEVER NEGATION. Every capability-shaped field is optional at
//      publish — validate_specs only enforces `required`, which for warehousing
//      is floor_area, ceiling_height, power_supply, security, truck_access. The
//      Chilled Store has no `dock_levellers` key because nobody filled it in,
//      not because it has none. So a missing or false flag renders NOTHING; we
//      never print "Dock levellers: No" and never imply a rival lacks a thing.
//   2. VALUES THAT MEAN "NOTHING" ARE SUPPRESSED. `power_supply: "None"` and
//      `customs_status: "Non-bonded"` are answers, not capabilities.
//   3. FREE TEXT IS NEVER RENDERED. `certifications`, `condition_notes` and
//      `licence_expiry` are unbounded supplier prose; they belong on S6's spec
//      table, not in a one-line summary.
import { listingCardSpec } from "./listing-spec";
import { splitListingTitle } from "./listing-title";
import type { AssetClass, StorefrontListing } from "./types";

// --- rules ------------------------------------------------------------------

type Rule =
  /** Rendered only when the value is exactly `true`. */
  | { key: string; kind: "bool"; label: string }
  /** One phrase per value; `null` suppresses that value entirely. */
  | { key: string; kind: "select"; phrases: Record<string, string | null> }
  /** One item per selected option, in the ALLOWLIST's order — the supplier's
   *  array order is arbitrary. Capped so one field can't fill the line. */
  | { key: string; kind: "multi"; order: string[]; max: number; phrases?: Record<string, string> }
  /** A count worth stating: "3 loading bays". Suppressed at 0. */
  | { key: string; kind: "count"; noun: string };

const TRAILER: Record<string, string | null> = {
  "Trailer-accessible": "Trailer access",
  "Light truck only": "Light trucks only",
};

const WAREHOUSING: Rule[] = [
  { key: "temperature_monitoring", kind: "bool", label: "Temperature monitoring" },
  { key: "backup_power", kind: "bool", label: "Backup power" },
  { key: "dock_levellers", kind: "bool", label: "Dock levellers" },
  // Fitted infrastructure ranks above access details: a hirer can work around
  // one fewer loading bay, but not around racking that isn't there.
  { key: "racking_installed", kind: "bool", label: "Racking installed" },
  { key: "climate_controlled", kind: "bool", label: "Climate controlled" },
  { key: "loading_bays", kind: "count", noun: "loading bays" },
  { key: "truck_access", kind: "select", phrases: TRAILER },
  {
    key: "power_supply",
    kind: "select",
    phrases: { "Three-phase": "Three-phase power", "Single-phase": "Single-phase power", None: null },
  },
  // `pallet_positions` is deliberately absent: it is the Dry Warehouse's CORE
  // figure (CORE_BY_TYPE), and repeating it as a capability would print the
  // same number twice on one card.
  {
    key: "security",
    kind: "multi",
    order: ["Guards 24-7", "CCTV", "Access control", "Fenced"],
    max: 2,
    phrases: { "Guards 24-7": "24-7 guards" },
  },
  { key: "fire_safety", kind: "multi", order: ["Sprinklers", "Hydrants", "Alarms", "Extinguishers"], max: 1 },
  { key: "cross_dock", kind: "bool", label: "Cross-dock" },
  { key: "office_space", kind: "bool", label: "Office space" },
  { key: "access_hours", kind: "select", phrases: { "24-7": "24-7 access", "Business hours": null } },
  {
    key: "customs_licence_status",
    kind: "select",
    phrases: { Active: "Customs licensed", Pending: null },
  },
];

const TERMINALS: Rule[] = [
  { key: "weighbridge", kind: "bool", label: "Weighbridge" },
  {
    key: "handling_equipment",
    kind: "multi",
    order: ["Reach stacker", "Empty handler", "Crane", "Forklift"],
    max: 2,
  },
  { key: "reefer_plugs", kind: "count", noun: "reefer plugs" },
  { key: "operating_hours", kind: "select", phrases: { "24-7": "Open 24-7", "Day shift": null, Custom: null } },
  { key: "rail_access", kind: "bool", label: "Rail access" },
  { key: "berth_access", kind: "bool", label: "Berth access" },
  { key: "customs_examination_area", kind: "bool", label: "Examination area" },
  {
    key: "gate_system",
    kind: "select",
    phrases: { Automated: "Automated gate", "Gate + tally": "Gate and tally", Manual: null },
  },
  {
    key: "surface_type",
    kind: "select",
    phrases: {
      Concrete: "Concrete surface",
      Interlocked: "Interlocked surface",
      Asphalt: "Asphalt surface",
      "Compacted laterite": null,
    },
  },
];

const LAND: Rule[] = [
  { key: "fencing", kind: "select", phrases: { "Fully fenced": "Fully fenced", Partial: null, Open: null } },
  { key: "access_road", kind: "select", phrases: TRAILER },
  { key: "utilities", kind: "multi", order: ["Power", "Water", "Drainage"], max: 2 },
  { key: "gantry_crane", kind: "bool", label: "Gantry crane" },
  { key: "covered_area", kind: "count", noun: "sqm covered" },
  { key: "security", kind: "multi", order: ["Guards", "CCTV", "Lighting", "Fenced"], max: 1 },
  { key: "gradient", kind: "select", phrases: { Level: "Level ground", Sloped: null } },
  {
    key: "surface_type",
    kind: "select",
    phrases: { Concrete: "Concrete surface", Tarmac: "Tarmac surface", Laterite: null, "Bare earth": null },
  },
];

const PLANT: Rule[] = [
  {
    key: "operator_included",
    kind: "select",
    phrases: {
      Included: "Operator included",
      "Available (extra)": "Operator available",
      "Not available": null,
    },
  },
  { key: "condition", kind: "select", phrases: { Excellent: "Excellent condition", Good: "Good condition", Fair: null } },
  { key: "fuel_type", kind: "select", phrases: { Electric: "Electric", Hybrid: "Hybrid", Diesel: null, Petrol: null } },
  { key: "ripper", kind: "bool", label: "Ripper fitted" },
  { key: "vibratory", kind: "bool", label: "Vibratory" },
  { key: "soundproof", kind: "bool", label: "Soundproof" },
  { key: "engine_power", kind: "count", noun: "hp" },
];

const TRUCKS: Rule[] = [
  {
    key: "driver_included",
    kind: "select",
    phrases: { Included: "Driver included", "Available (extra)": "Driver available", "Not available": null },
  },
  {
    key: "insurance_cover",
    kind: "select",
    phrases: {
      Comprehensive: "Comprehensive cover",
      "Goods-in-transit": "Goods-in-transit cover",
      "Third-party": null,
      "None disclosed": null,
    },
  },
  { key: "tail_lift", kind: "bool", label: "Tail lift" },
  { key: "ramps", kind: "bool", label: "Ramps" },
  { key: "pump", kind: "bool", label: "Pump fitted" },
  { key: "operating_range", kind: "select", phrases: { Nationwide: "Nationwide", Regional: "Regional", "State only": null } },
];

const RULES: Record<AssetClass, Rule[]> = {
  warehousing: WAREHOUSING,
  terminals_yards: TERMINALS,
  land_staging: LAND,
  plant_machinery: PLANT,
  trucks_haulage: TRUCKS,
};

/** Values that appear in more than one field's allowlist and always mean "no". */
const ABSENCE = new Set(["None", "None — hirer brings own", "None - hirer brings own"]);

// --- figures ----------------------------------------------------------------

/** 1200 → "1,200". Hermes' Intl support is not guaranteed, so group by hand. */
export function groupThousands(n: number): string {
  const [whole, fraction] = String(n).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

// --- capabilities -----------------------------------------------------------

/**
 * The capabilities a listing's specs actually assert, best first.
 * Order is fixed per class — never relative to sibling listings, which would
 * make one supplier's edit silently rewrite another listing's card.
 */
export function capabilities(
  assetClass: AssetClass,
  specs: Record<string, unknown> | undefined,
  limit = Infinity,
): string[] {
  if (!specs) return [];
  const out: string[] = [];
  for (const rule of RULES[assetClass] ?? []) {
    if (out.length >= limit) break;
    const value = specs[rule.key];
    if (value === undefined || value === null) continue;

    if (rule.kind === "bool") {
      if (value === true) out.push(rule.label);
      continue;
    }
    if (rule.kind === "select") {
      if (typeof value !== "string" || ABSENCE.has(value)) continue;
      const phrase = rule.phrases[value];
      if (phrase) out.push(phrase);
      continue;
    }
    if (rule.kind === "count") {
      const n = asNumber(value);
      if (n !== null && n > 0) out.push(`${groupThousands(n)} ${rule.noun}`);
      continue;
    }
    // multi
    if (!Array.isArray(value)) continue;
    const chosen = new Set(value.filter((v): v is string => typeof v === "string"));
    let taken = 0;
    for (const option of rule.order) {
      if (taken >= rule.max || out.length >= limit) break;
      if (!chosen.has(option) || ABSENCE.has(option)) continue;
      out.push(rule.phrases?.[option] ?? option);
      taken += 1;
    }
  }
  return limit === Infinity ? out : out.slice(0, limit);
}

/** Capabilities every one of these listings asserts — the storefront-wide line.
 *  Intersection of the full (unlimited) lists, so it never depends on a cap. */
export function sharedCapabilities(
  items: { asset_class: AssetClass; specs: Record<string, unknown> | undefined }[],
): string[] {
  if (items.length < 2) return [];
  const lists = items.map((i) => capabilities(i.asset_class, i.specs));
  if (lists.some((l) => l.length === 0)) return [];
  const [first, ...rest] = lists;
  return first.filter((cap) => rest.every((l) => l.includes(cap)));
}

// --- the core specification line --------------------------------------------

/** Which spec answers "what is it and how big", per asset type then class. */
const CORE_BY_TYPE: Record<string, string[]> = {
  "Cold Storage": ["temperature_range", "floor_area"],
  "Dry Warehouse": ["floor_area", "pallet_positions"],
  "Bonded Warehouse": ["floor_area"],
  "Distribution Centre": ["floor_area", "dock_doors"],
  "Self-Storage Unit": ["unit_size"],
};

const CORE_BY_CLASS: Record<AssetClass, string[]> = {
  warehousing: ["floor_area", "ceiling_height"],
  terminals_yards: ["container_capacity", "total_area"],
  land_staging: ["area"],
  plant_machinery: ["operating_weight", "engine_power"],
  trucks_haulage: ["payload_capacity"],
};

/** Units and nouns for the core figures (same vocabulary as doc 05). */
const CORE_UNITS: Record<string, string> = {
  floor_area: "sqm",
  unit_size: "sqm",
  total_area: "sqm",
  area: "sqm",
  covered_area: "sqm",
  container_capacity: "TEU",
  operating_weight: "t",
  payload_capacity: "t",
  ceiling_height: "m ceiling",
  engine_power: "hp",
  pallet_positions: "pallet spaces",
  dock_doors: "dock doors",
};

/** True when the supplier already put this figure in the title, so the core
 *  line does not say "−18°C" twice on one card. */
function alreadyInName(name: string, phrase: string): boolean {
  const haystack = name.toLowerCase();
  const digits = phrase.split(/\s+/).filter((token) => /\d/.test(token));
  if (digits.length === 0) return haystack.includes(phrase.toLowerCase());
  return digits.some((token) => haystack.includes(token.toLowerCase()));
}

export type CoreSpec = {
  /** The asset's name, from the supplier's title. */
  name: string;
  /** "Frozen −18°C · 800 sqm" — or the title-derived measure before specs land. */
  spec: string;
  /** True when `spec` is figure-led, so it renders in mono. */
  figure: boolean;
};

/**
 * The card's first two lines.
 *
 * Specs come off the storefront payload itself since D-030; `override` is the
 * per-listing read the screen still performs for any listing that arrives
 * without them (an API older than that decision). Falls back to the shipped
 * title derivation (lib/listing-spec.ts) when there are no specs at all, so an
 * unresolved card is structurally identical to a resolved one.
 */
export function coreSpecLine(listing: StorefrontListing, override?: Record<string, unknown>): CoreSpec {
  const derived = listingCardSpec(listing);
  const specs = listing.specs ?? override;
  if (!specs) return derived;

  const keys = CORE_BY_TYPE[listing.asset_type] ?? CORE_BY_CLASS[listing.asset_class] ?? [];
  const parts: string[] = [];
  for (const key of keys) {
    const value = specs[key];
    if (value === undefined || value === null) continue;
    const unit = CORE_UNITS[key];
    let phrase: string;
    if (typeof value === "number") {
      if (value <= 0) continue;
      phrase = unit ? `${groupThousands(value)} ${unit}` : groupThousands(value);
    } else if (typeof value === "string") {
      phrase = value;
    } else {
      continue;
    }
    if (alreadyInName(derived.name, phrase)) continue;
    parts.push(phrase);
  }

  if (parts.length === 0) return derived;
  return { name: derived.name, spec: parts.join(" · "), figure: true };
}

/** "Wide-load escort" / "Cold Storage" — what the card says before specs land.
 *  Real information the storefront payload already carries, never a shimmer. */
function fallbackLine(listing: StorefrontListing, core: string): string {
  const { qualifier } = splitListingTitle(listing.title);
  const type = (listing.asset_type ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (type && !alreadyInName(type, core)) return type;
  return qualifier ?? type;
}

/** The card's capability row — never empty, so its height never changes. */
export function capabilityLine(listing: StorefrontListing, override?: Record<string, unknown>): string {
  const found = capabilities(listing.asset_class, listing.specs ?? override, 3);
  if (found.length > 0) return found.join(" · ");
  return fallbackLine(listing, coreSpecLine(listing, override).spec);
}
