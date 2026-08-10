// The one useful spec line for a storefront listing card.
//
// Why this is derived and not read: GET /storefronts/{id} returns each Live
// listing as {id, title, asset_class, asset_type, daily_price_display,
// cover_photo_url, yard_id} — verified against
// listings/services/storefront.py. There is NO `specs` object on that payload,
// and the storefront pass may not change the backend, so the card cannot read
// "operating weight: 30 t" from the server.
//
// What it can do is read what the supplier already wrote. Titles follow
// "<asset> <measure> — <purpose>" in practice ("Transit Concrete Mixer 8 m³",
// "Lowbed Trailer 60t", "250 kVA Generator"), so the measure is in the string —
// it was just being rendered as part of a truncating title while the second
// line spent itself on the asset CLASS ("Plant & Machinery"), which is the same
// for every card on most storefronts and therefore tells a hirer nothing.
//
// Same convention as lib/listing-title.ts: a client-side read of a string the
// API already sends, no contract change. Kept honest about its limits — it
// reports the figure the supplier typed, never a named spec field, because a
// bare number in a title cannot be attributed to `operating_weight` with any
// certainty (it might be reach, drum size or year).
import { CLASS_BY_VALUE } from "./asset-classes";
import { splitListingTitle } from "./listing-title";
import type { AssetClass } from "./types";

/** Dimension a matched unit belongs to — what lets a class prefer one figure
 *  over another when a title carries several ("20 ft container yard, 500 TEU"). */
type Family = "mass" | "volume" | "area" | "teu" | "power" | "length" | "flow" | "capacity";

/** Units suppliers actually write, with the form we render back. Order is
 *  load-bearing: the alternation is tried left to right, so anything that
 *  starts with a shorter unit's letters must come first ("m³"/"m2" before "m",
 *  "tonnes" before "t"). */
const UNITS: { pattern: string; canon: string; family: Family }[] = [
  { pattern: String.raw`tonnes?|tons?|t`, canon: "t", family: "mass" },
  { pattern: String.raw`kg`, canon: "kg", family: "mass" },
  { pattern: String.raw`m³|m3|cbm|cubic\s?m(?:etres?|eters?)?`, canon: "m³", family: "volume" },
  { pattern: String.raw`litres?|liters?`, canon: "L", family: "volume" },
  { pattern: String.raw`sqm|sq\.?\s?m|m²|m2|square\s?m(?:etres?|eters?)?`, canon: "sqm", family: "area" },
  { pattern: String.raw`hectares?|ha`, canon: "ha", family: "area" },
  { pattern: String.raw`acres?`, canon: "acres", family: "area" },
  { pattern: String.raw`teu`, canon: "TEU", family: "teu" },
  { pattern: String.raw`kva`, canon: "kVA", family: "power" },
  { pattern: String.raw`kw`, canon: "kW", family: "power" },
  { pattern: String.raw`bhp|hp`, canon: "hp", family: "power" },
  { pattern: String.raw`m(?:etres?|eters?)?`, canon: "m", family: "length" },
  { pattern: String.raw`ft|feet|foot`, canon: "ft", family: "length" },
  { pattern: String.raw`cfm`, canon: "cfm", family: "flow" },
  { pattern: String.raw`pallets?`, canon: "pallets", family: "capacity" },
  { pattern: String.raw`bays?`, canon: "bays", family: "capacity" },
];

/** "20,000" · "8.5" · "60" — thousands-grouped first so "20,000" never reads
 *  as "20". */
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;

// The leading group replaces a lookbehind (Hermes support is not guaranteed):
// it makes the number's left edge explicit — start of string, or a character
// that cannot be part of a word or a longer number — so "A320m" and the "4" of
// "8x4" never open a measure. The trailing lookahead does the same on the
// right, so "2 trailers" never matches the "t" of tonnes.
const MEASURE = new RegExp(
  `(^|[^A-Za-z0-9.,])(${NUMBER})\\s?(${UNITS.map((u) => u.pattern).join("|")})(?![A-Za-z0-9])`,
  "gi",
);

export type Measure = {
  /** Render-ready, canonical unit: "60 t", "8 m³", "20,000 sqm", "250 kVA". */
  text: string;
  family: Family;
  /** Where the figure sits in the source string, so a caller can lift it out. */
  at: number;
  length: number;
};

/** Which dimensions matter for a class, best first. Seeded from the ★ headline
 *  spec each class filters on (lib/star-field.ts) and extended with the figures
 *  that class's titles carry next most often. */
const PREFERRED: Record<AssetClass, Family[]> = {
  plant_machinery: ["mass", "power", "volume", "length"],
  trucks_haulage: ["mass", "volume", "length"],
  warehousing: ["area", "capacity", "volume", "length"],
  terminals_yards: ["teu", "area", "capacity"],
  land_staging: ["area", "length"],
};

/** Every measure in a string, in the order written. */
export function findMeasures(text: string): Measure[] {
  const found: Measure[] = [];
  MEASURE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MEASURE.exec(text)) !== null) {
    const [whole, prefix, figure, unit] = match;
    const entry = UNITS.find((u) => new RegExp(`^(?:${u.pattern})$`, "i").test(unit));
    if (!entry) continue;
    found.push({
      text: `${figure} ${entry.canon}`,
      family: entry.family,
      at: match.index + prefix.length,
      length: whole.length - prefix.length,
    });
  }
  return found;
}

/** The measure a hirer of THIS class scans for: the earliest figure in the
 *  class's best-available family, else the first figure of any kind. */
export function pickMeasure(text: string, assetClass: AssetClass): Measure | null {
  const found = findMeasures(text);
  if (found.length === 0) return null;
  for (const family of PREFERRED[assetClass] ?? []) {
    const hit = found.find((m) => m.family === family);
    if (hit) return hit;
  }
  return found[0];
}

/** "Forklift (industrial)" → "Forklift". The parenthetical disambiguates the
 *  seed catalogue (doc 05), not the card — and it is what pushes the line past
 *  a two-up card's width. */
function typeLabel(assetType: string): string {
  return (assetType ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Left over after a figure is lifted out: doubled spaces, and separators or
 *  commas now dangling at either end. */
function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,·|/–—-]+/, "")
    .replace(/[\s,·|/–—-]+$/, "")
    .trim();
}

export type ListingCardSpec = {
  /** The asset, with any surfaced figure lifted out so it is never shown twice. */
  name: string;
  /** The one line under the name: a figure when the title carries one, else the
   *  most specific description available. Never empty. */
  spec: string;
  /** True when `spec` is a figure — figures render in mono (03 §Numerals). */
  figure: boolean;
};

/**
 * The two text lines of a storefront listing card.
 *
 *   Transit Concrete Mixer 8 m³ — ready-mix delivery
 *     → { name: "Transit Concrete Mixer", spec: "8 m³", figure: true }
 *
 *   Site Excavator — trenching        (asset_type "Excavator")
 *     → { name: "Site Excavator", spec: "Trenching", figure: false }
 *       ...because "Excavator" is already in the name; the qualifier says more.
 */
export function listingCardSpec(listing: {
  title: string;
  asset_type: string;
  asset_class: AssetClass;
}): ListingCardSpec {
  const title = (listing.title ?? "").trim();
  const { name: rawName, qualifier } = splitListingTitle(title);
  const picked = pickMeasure(title, listing.asset_class);

  // Only lift the figure out when it sits in the NAME — a measure inside the
  // qualifier ("— 8 m³ drum") is not what the first line is showing.
  const inName = picked !== null && picked.at + picked.length <= rawName.length;
  const stripped = inName
    ? tidy(rawName.slice(0, picked.at) + rawName.slice(picked.at + picked.length))
    : "";
  const name = stripped || rawName;

  if (picked) return { name, spec: picked.text, figure: true };

  const type = typeLabel(listing.asset_type);
  const classLabel = CLASS_BY_VALUE[listing.asset_class]?.label ?? "";
  // Repeating the name in smaller grey text is the same non-information as the
  // class label was, so the qualifier gets the line instead.
  // ...and when there is no qualifier either, the class label is at least a
  // different fact about the asset.
  const duplicate = type !== "" && name.toLowerCase().includes(type.toLowerCase());
  const spec = (duplicate ? qualifier || classLabel : type) || qualifier || classLabel;
  return { name, spec, figure: false };
}
