// What to call the things on a storefront (D-029).
//
// The approved Lexicon (doc 02 §2) rejected "Facilities" as a category name —
// "Facilities is vague (a warehouse is also a facility)" — and settled on
// **Asset** as the umbrella word for anything hireable. That ruling still
// holds for identifiers, API fields and DB columns, which stay lexicon-clean.
//
// D-029 narrows it for DISPLAY COPY only: on a storefront selling cold rooms
// and container yards, "3 assets" is technically correct and commercially
// tone-deaf — a hirer looking for storage searches for a facility. But calling
// a 30-tonne excavator a facility is simply wrong, and 8 of the 16 seeded
// storefronts carry more than one class, so the noun has to be derived, not
// assumed.
//
// Mixed storefronts fall back to "listings" — the Lexicon's own word for a
// published offer (doc 02 §2), true of every class, and the only honest option
// when one page holds both a laydown yard and a tipper truck.
import type { AssetClass } from "./types";

/** Classes a hirer would call a place rather than a machine. */
const FACILITY_CLASSES: readonly AssetClass[] = ["warehousing", "terminals_yards", "land_staging"];

export type AssetNoun = {
  one: string;
  many: string;
  /** Which rule fired — asserted in tests so the fallback can't rot silently. */
  kind: "facility" | "asset" | "listing";
};

const FACILITY: AssetNoun = { one: "facility", many: "facilities", kind: "facility" };
const ASSET: AssetNoun = { one: "asset", many: "assets", kind: "asset" };
const LISTING: AssetNoun = { one: "listing", many: "listings", kind: "listing" };

/**
 * The noun for a whole storefront, from the classes actually on it.
 *
 *   all warehousing/terminals/land → facility · facilities
 *   all plant/trucks              → asset · assets
 *   mixed, or nothing listed      → listing · listings
 */
export function assetNoun(classes: readonly AssetClass[]): AssetNoun {
  if (classes.length === 0) return LISTING;
  const distinct = new Set(classes);
  let facility = 0;
  for (const cls of distinct) {
    if (FACILITY_CLASSES.includes(cls)) facility += 1;
  }
  if (facility === distinct.size) return FACILITY;
  if (facility === 0) return ASSET;
  return LISTING;
}

/** The noun for ONE listing — used by a card's own "View facility →" affordance,
 *  which should follow the thing it opens rather than the page it sits on. */
export function nounFor(assetClass: AssetClass): AssetNoun {
  return assetNoun([assetClass]);
}

/** "3 facilities" / "1 facility" — the count and its noun, already agreed. */
export function countNoun(n: number, noun: AssetNoun): string {
  return `${n} ${n === 1 ? noun.one : noun.many}`;
}
