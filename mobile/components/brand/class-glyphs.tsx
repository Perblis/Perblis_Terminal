// Ported from portal/components/brand/class-glyphs.tsx (Wave 7) to
// react-native-svg — one custom-drawn glyph per class, single-weight
// strokes, colour applied by the consumer. Class hues fixed by 02 §3.
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import type { AssetClass } from "../../lib/types";

export type GlyphProps = { size?: number; color?: ColorValue };

const stroke = { strokeWidth: 1.8, strokeLinecap: "square" as const, fill: "none" as const };

/** Plant & Machinery — excavator arm + tracks. */
export function PlantGlyph({ size = 18, color = "#FFFFFF" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={14} width={9} height={4} rx={2} stroke={color} {...stroke} />
      <Path d="M5 14v-3h5l3-5 5 2-2 4" stroke={color} {...stroke} />
      <Path d="M16 12l3 4h-5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Trucks & Haulage — flatbed cab + load. */
export function TrucksGlyph({ size = 18, color = "#FFFFFF" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 16V8h11v8" stroke={color} {...stroke} />
      <Path d="M13 10h5l3 4v2" stroke={color} {...stroke} />
      <Circle cx={7} cy={17.5} r={1.8} stroke={color} {...stroke} />
      <Circle cx={17} cy={17.5} r={1.8} stroke={color} {...stroke} />
    </Svg>
  );
}

/** Warehousing & Storage — gabled shed with door. */
export function WarehouseGlyph({ size = 18, color = "#FFFFFF" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 10l9-5 9 5v9H3z" stroke={color} {...stroke} />
      <Path d="M8 19v-6h8v6" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Terminals & Container Yards — stacked containers + gantry. */
export function TerminalsGlyph({ size = 18, color = "#FFFFFF" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={13} width={7} height={5} stroke={color} {...stroke} />
      <Rect x={13} y={13} width={7} height={5} stroke={color} {...stroke} />
      <Rect x={8.5} y={7} width={7} height={5} stroke={color} {...stroke} />
      <Path d="M3 5h18" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Land & Staging — plot boundary + survey pin. */
export function LandGlyph({ size = 18, color = "#FFFFFF" }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 18l3-11 13 2-2 9z" strokeDasharray="3 2" stroke={color} {...stroke} />
      <Circle cx={12} cy={13} r={1.6} stroke={color} {...stroke} />
    </Svg>
  );
}

export const CLASS_GLYPHS: Record<AssetClass, (props: GlyphProps) => React.JSX.Element> = {
  plant_machinery: PlantGlyph,
  trucks_haulage: TrucksGlyph,
  warehousing: WarehouseGlyph,
  terminals_yards: TerminalsGlyph,
  land_staging: LandGlyph,
};
