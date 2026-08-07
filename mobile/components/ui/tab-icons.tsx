import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: ColorValue; size?: number };

/** Teardrop pin — Map tab. */
export function MapIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 7-7Z"
        stroke={color}
        strokeWidth={2}
      />
      <Circle cx={12} cy={10} r={2.5} fill={color} />
    </Svg>
  );
}

/** Clipboard/manifest — Hires tab. */
export function HiresIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={17} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M9 4V2.5h6V4" stroke={color} strokeWidth={2} strokeLinecap="square" />
      <Path d="M8.5 10h7M8.5 14h7M8.5 18h4" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}

/** Squared speech bubble — Messages tab (B2B-hybrid, not a rounded chat blob). */
export function MessagesIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v11h-9l-4.5 3.5V16H4V5Z" stroke={color} strokeWidth={2} strokeLinejoin="miter" />
      <Path d="M8 9.5h8M8 12.5h5" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}

/** Hard-hat profile — Profile tab. */
export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
