import Svg, { Path, Rect } from "react-native-svg";

/**
 * T-crane brand glyph (01 §1, packages/tokens/glyphs/brand/t-crane.svg):
 * a "T" whose arm extends right like a tower-crane jib.
 */
export function TCrane({ size = 48, color = "#F5A700" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16" stroke={color} strokeWidth={2.5} strokeLinecap="square" />
      <Path d="M9 5v15" stroke={color} strokeWidth={2.5} strokeLinecap="square" />
      <Path d="M18 5v4" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
      <Rect x={16.25} y={9} width={3.5} height={3} fill={color} />
    </Svg>
  );
}
