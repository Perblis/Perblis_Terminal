import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

/**
 * Live-map tease backdrop (wave-8-vision V3): until 8B's real Terminal
 * Chart renders behind onboarding, a crafted chart scene — Lagos-ish
 * coastline, depth lines, class-coloured pins — carries the identity.
 * Swap for the blurred live map in 8B; this component is the seam.
 */
export function ChartTease() {
  return (
    <View className="absolute inset-0 bg-ink-900" accessible={false}>
      <Svg width="100%" height="100%" viewBox="0 0 375 812" preserveAspectRatio="xMidYMid slice">
        {/* water */}
        <Path d="M0 500 Q120 460 200 520 T375 500 V812 H0 Z" fill="#1C2733" opacity={0.9} />
        {/* depth lines */}
        <G stroke="#3A3F4A" strokeWidth={1} opacity={0.5} fill="none">
          <Path d="M0 540 Q130 500 210 555 T375 540" />
          <Path d="M0 585 Q140 545 220 595 T375 585" />
          <Path d="M0 635 Q150 595 230 640 T375 635" />
        </G>
        {/* shore grid — faint street hints */}
        <G stroke="#23262E" strokeWidth={1.5} opacity={0.8}>
          <Path d="M40 80 L280 300" />
          <Path d="M110 40 L330 260" />
          <Path d="M0 220 L240 440" />
          <Path d="M180 60 L60 320" />
          <Path d="M300 120 L140 420" />
        </G>
        {/* yard squircle pin */}
        <G>
          <Path
            d="M150 250 h36 a10 10 0 0 1 10 10 v36 a10 10 0 0 1 -10 10 h-36 a10 10 0 0 1 -10 -10 v-36 a10 10 0 0 1 10 -10 Z"
            fill="#16181D"
            stroke="#F59E0B"
            strokeWidth={2.5}
          />
          <Circle cx={196} cy={252} r={9} fill="#F59E0B" />
        </G>
        {/* asset teardrop pins, class hues */}
        <G>
          <Path d="M90 380 a14 14 0 1 1 28 0 c0 10 -14 24 -14 24 s-14 -14 -14 -24 Z" fill="#F59E0B" stroke="#16181D" strokeWidth={1.5} />
          <Path d="M255 330 a14 14 0 1 1 28 0 c0 10 -14 24 -14 24 s-14 -14 -14 -24 Z" fill="#3B82F6" stroke="#16181D" strokeWidth={1.5} />
          <Path d="M300 430 a14 14 0 1 1 28 0 c0 10 -14 24 -14 24 s-14 -14 -14 -24 Z" fill="#22C55E" stroke="#16181D" strokeWidth={1.5} />
        </G>
        {/* compass rose, chart identity */}
        <G opacity={0.6}>
          <Circle cx={320} cy={700} r={26} stroke="#6B7280" strokeWidth={1} fill="none" />
          <Path d="M320 678 L326 700 L320 722 L314 700 Z" fill="#F59E0B" />
        </G>
      </Svg>
    </View>
  );
}
