import Svg, { Path } from "react-native-svg";

/**
 * Terminal brand mark (01 §1, packages/tokens/glyphs/brand/t-crane.svg):
 * a map pin with a crane-hook cutout — map-first identity, crane DNA.
 */
export function TCrane({ size = 48, color = "#E0ED34" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 10.0 5.0 C 9.9 5.0 9.9 5.0 9.8 5.1 C 8.6 5.6 7.7 6.4 7.1 7.5 C 7.0 7.6 7.0 7.7 6.9 7.7 C 6.2 9.1 6.1 10.8 6.5 12.2 C 6.9 13.5 7.8 14.7 8.6 15.8 C 8.9 16.2 9.2 16.7 9.5 17.1 C 10.6 18.9 10.6 18.9 11.7 19.3 C 12.0 19.3 12.2 19.3 12.5 19.2 C 12.5 19.2 12.6 19.2 12.6 19.1 C 13.4 18.9 13.8 18.3 14.2 17.6 C 14.4 17.3 14.7 17.0 14.9 16.6 C 15.0 16.5 15.1 16.4 15.2 16.2 C 15.2 16.2 15.2 16.2 15.2 16.1 C 15.3 16.0 15.4 15.9 15.4 15.9 C 15.5 15.8 15.5 15.7 15.6 15.6 C 15.8 15.3 16.0 15.1 16.2 14.8 C 16.2 14.7 16.3 14.6 16.4 14.5 C 16.9 13.6 17.5 12.7 17.7 11.7 C 17.7 11.6 17.7 11.6 17.7 11.5 C 18.0 9.9 17.6 8.4 16.7 7.1 C 15.9 5.9 14.6 5.0 13.1 4.7 C 12.1 4.6 11.0 4.6 10.0 5.0 Z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}
