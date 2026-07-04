// The asset-class identity kit (wave-7-vision.md): one custom-drawn glyph per
// class, single-weight strokes, colour applied by the consumer (currentColor).
// Class hues are fixed by 02 §3 and never repurposed.
import type { SVGProps } from "react";

import type { AssetClass } from "@/lib/types";

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: GlyphProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "square" as const,
    "aria-hidden": true,
    ...rest,
  };
}

/** Plant & Machinery — excavator arm + tracks. */
export function PlantGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="14" width="9" height="4" rx="2" />
      <path d="M5 14v-3h5l3-5 5 2-2 4" />
      <path d="M16 12l3 4h-5" />
    </svg>
  );
}

/** Trucks & Haulage — flatbed cab + load. */
export function TrucksGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 16V8h11v8" />
      <path d="M13 10h5l3 4v2" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

/** Warehousing & Storage — gabled shed with door. */
export function WarehouseGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10l9-5 9 5v9H3z" />
      <path d="M8 19v-6h8v6" />
    </svg>
  );
}

/** Terminals & Container Yards — stacked containers + gantry. */
export function TerminalsGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="13" width="7" height="5" />
      <rect x="13" y="13" width="7" height="5" />
      <rect x="8.5" y="7" width="7" height="5" />
      <path d="M3 5h18" />
    </svg>
  );
}

/** Land & Staging — plot boundary + survey pin. */
export function LandGlyph(props: GlyphProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 18l3-11 13 2-2 9z" strokeDasharray="3 2" />
      <circle cx="12" cy="13" r="1.6" />
    </svg>
  );
}

export const CLASS_GLYPHS: Record<AssetClass, (props: GlyphProps) => React.JSX.Element> = {
  plant_machinery: PlantGlyph,
  trucks_haulage: TrucksGlyph,
  warehousing: WarehouseGlyph,
  terminals_yards: TerminalsGlyph,
  land_staging: LandGlyph,
};
