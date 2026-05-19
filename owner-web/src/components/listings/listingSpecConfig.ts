import type { ResourceType } from "@/lib/constants";

export type SpecFieldType = "text" | "number" | "select" | "boolean";

export type SpecField = {
  key: string;
  label: string;
  hint?: string;
  type: SpecFieldType;
  options?: { value: string; label: string }[];
};

/** Typed specification fields stored in `Listing.specs` (JSON), keyed by resource type. */
export const SPECS_BY_RESOURCE: Record<ResourceType, SpecField[]> = {
  equipment: [
    { key: "make_model", label: "Make & model", hint: "e.g. Caterpillar 320", type: "text" },
    { key: "model_year", label: "Model year", type: "number" },
    { key: "operating_weight_t", label: "Operating weight (t)", type: "number" },
    { key: "lift_capacity_t", label: "Max lift / load (t)", type: "number" },
    { key: "boom_reach_m", label: "Boom / reach (m)", hint: "Optional", type: "number" },
    {
      key: "fuel_type",
      label: "Fuel",
      type: "select",
      options: [
        { value: "", label: "—" },
        { value: "diesel", label: "Diesel" },
        { value: "electric", label: "Electric" },
        { value: "hybrid", label: "Hybrid" },
        { value: "gas", label: "Gas" },
        { value: "other", label: "Other" },
      ],
    },
  ],
  vehicle: [
    { key: "make_model", label: "Make & model", hint: "e.g. Mercedes Actros", type: "text" },
    { key: "model_year", label: "Model year", type: "number" },
    { key: "gvwr_t", label: "GVWR (t)", hint: "Gross vehicle weight rating", type: "number" },
    { key: "body_type", label: "Body / configuration", hint: "e.g. flatbed 12m, tipper", type: "text" },
    { key: "seating_capacity", label: "Seating capacity", hint: "Optional", type: "number" },
  ],
  warehouse: [
    { key: "floor_area_sqm", label: "Floor area (m²)", type: "number" },
    { key: "clear_height_m", label: "Clear height (m)", type: "number" },
    { key: "dock_doors", label: "Dock doors", type: "number" },
    {
      key: "temperature_controlled",
      label: "Temperature controlled",
      hint: "Cold chain / climate",
      type: "boolean",
    },
    { key: "floor_load_knm2", label: "Floor load (kN/m²)", hint: "Optional", type: "number" },
  ],
  terminal: [
    { key: "teu_capacity", label: "Nominal TEU capacity", type: "number" },
    { key: "yard_area_sqm", label: "Yard / paved area (m²)", type: "number" },
    { key: "reach_stackers", label: "Reach stackers / RTGs", hint: "Count", type: "number" },
    { key: "bonded_customs", label: "Bonded / customs area", type: "boolean" },
  ],
  facility: [
    { key: "site_area_sqm", label: "Usable site area (m²)", type: "number" },
    {
      key: "paved_percent",
      label: "Paved surface (%)",
      hint: "0–100",
      type: "number",
    },
    { key: "fenced", label: "Fenced / secured perimeter", type: "boolean" },
    { key: "power_amps_3phase", label: "3-phase power (A)", hint: "Optional", type: "number" },
  ],
};

function specKeysFor(resourceType: ResourceType): Set<string> {
  return new Set(SPECS_BY_RESOURCE[resourceType].map((f) => f.key));
}

/** Coerce API / form values into a clean `specs` object for PATCH/POST (current resource type only). */
export function pickSpecsForApi(
  resourceType: ResourceType,
  specs: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const allowed = specKeysFor(resourceType);
  const out: Record<string, string | number | boolean> = {};
  if (!specs) return out;

  for (const key of allowed) {
    const raw = specs[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "boolean") {
      out[key] = raw;
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
      continue;
    }
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t === "") continue;
      const n = Number(t);
      const field = SPECS_BY_RESOURCE[resourceType].find((f) => f.key === key);
      if (field?.type === "number") {
        if (Number.isFinite(n)) out[key] = n;
      } else if (field?.type === "boolean") {
        out[key] = t === "true" || t === "1" || t === "on";
      } else {
        out[key] = t;
      }
    }
  }
  return out;
}

/**
 * When PATCH includes `specs`, DRF replaces the entire JSONField. Preserve keys the owner
 * portal does not model (other clients, legacy data) by carrying them over from the server
 * snapshot for the same `resource_type`. On resource type change, use `picked` only so the
 * new type’s typed namespace is authoritative.
 */
export function mergeServerSpecsWithPicked(
  serverSpecs: Record<string, unknown> | null | undefined,
  resourceType: ResourceType,
  picked: Record<string, string | number | boolean>,
): Record<string, unknown> {
  const allowed = specKeysFor(resourceType);
  const out: Record<string, unknown> = {};
  if (serverSpecs) {
    for (const [k, v] of Object.entries(serverSpecs)) {
      if (allowed.has(k)) continue;
      out[k] = v;
    }
  }
  Object.assign(out, picked);
  return out;
}

/** Checkbox-friendly defaults for boolean spec fields (new listing / after type change). */
export function specsFormBaseDefaults(
  resourceType: ResourceType,
): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const f of SPECS_BY_RESOURCE[resourceType]) {
    if (f.type === "boolean") out[f.key] = false;
  }
  return out;
}

/** Defaults for react-hook-form from API listing.specs (unknown keys ignored for typed fields). */
export function specsDefaultsForForm(
  resourceType: ResourceType,
  apiSpecs: Record<string, string | number | boolean> | null | undefined,
): Record<string, string | number | boolean | undefined> {
  const keys = specKeysFor(resourceType);
  const out: Record<string, string | number | boolean | undefined> = {};
  if (!apiSpecs) return out;
  for (const key of keys) {
    const v = apiSpecs[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "boolean") {
      out[key] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t === "") continue;
      const field = SPECS_BY_RESOURCE[resourceType].find((f) => f.key === key);
      if (field?.type === "number") {
        const n = Number(t);
        if (Number.isFinite(n)) out[key] = n;
      } else {
        out[key] = t;
      }
    }
  }
  return out;
}

export function labelForSpecKey(resourceType: ResourceType, key: string): string | null {
  const f = SPECS_BY_RESOURCE[resourceType].find((x) => x.key === key);
  return f?.label ?? null;
}
