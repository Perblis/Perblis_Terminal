// The ★ headline spec per asset class — the ONE filterable field that
// /search/{map,list}'s `spec_min`/`spec_max` range targets for the active class.
//
// Mirrors `backend/listings/spec_data.py::_STAR_FIELDS` (doc 05 §7), which
// derives it as the first `filterable=True` field in each class-common set.
// Kept in sync by COPY, not import — the same convention as `lib/naira.ts`
// and `lib/asset-classes.ts` (design.md §7 wave isolation).
//
// Why this file exists: the search screen labelled these inputs "★ spec min" /
// "★ spec max", because the client had no way to name the field. The only
// server source is GET /spec-templates, which requires an `asset_type` — and
// search filters by CLASS, not type, so it can never call it. A hirer filtering
// excavators was being asked for a bounded range on an unnamed, unitless
// quantity.
import type { AssetClass } from "./types";

export type StarField = {
  /** Spec key on the listing — matches the backend field name exactly. */
  key: string;
  /** Human label, verbatim from the backend field definition. */
  label: string;
  /** Unit of measure, verbatim from the backend field definition. */
  unit: string;
};

export const STAR_FIELDS: Record<AssetClass, StarField> = {
  plant_machinery: { key: "operating_weight", label: "Operating weight", unit: "tonnes" },
  trucks_haulage: { key: "payload_capacity", label: "Payload capacity", unit: "tonnes" },
  warehousing: { key: "floor_area", label: "Floor area", unit: "sqm" },
  terminals_yards: { key: "container_capacity", label: "Container capacity", unit: "TEU" },
  land_staging: { key: "area", label: "Area", unit: "sqm" },
};

/** The ★ spec for a class, or null when there is no class selected — the
 *  server 400s a spec bound without one, so the UI hides it in that case. */
export function starField(assetClass: AssetClass | null | undefined): StarField | null {
  if (!assetClass) return null;
  return STAR_FIELDS[assetClass] ?? null;
}

/** "Operating weight (tonnes)" — the section heading for the range inputs. */
export function starFieldTitle(assetClass: AssetClass | null | undefined): string {
  const field = starField(assetClass);
  return field ? `${field.label} (${field.unit})` : "Specifications";
}

/** Compact form for an active-filter chip: "Operating weight 10–30 t". */
export function starFieldChipLabel(
  assetClass: AssetClass | null | undefined,
  min: string,
  max: string,
): string {
  const field = starField(assetClass);
  const range = `${min || "…"}–${max || "…"}`;
  return field ? `${field.label} ${range} ${field.unit}` : `★ ${range}`;
}
