import { View } from "react-native";
import Svg, { Defs, Pattern, Path, Rect } from "react-native-svg";

/**
 * Hazard stripe (M1): 45° amber/ink chevrons. SVG pattern — RN has no
 * repeating-linear-gradient.
 */
export function HazardStripe({ height = 6 }: { height?: number }) {
  return (
    <View style={{ height }} accessible={false}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="hazard" width={16} height={height} patternUnits="userSpaceOnUse">
            <Rect width={16} height={height} fill="#16181D" />
            <Path d={`M0 ${height} L${height} 0 H${height + 8} L8 ${height} Z`} fill="#F59E0B" />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill="url(#hazard)" />
      </Svg>
    </View>
  );
}
