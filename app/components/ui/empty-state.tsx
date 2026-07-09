import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { BodyText, DisplayText } from "./text";

/**
 * Chart-motif empty state (V12): compass rose + depth lines tie empties to
 * the map identity. Copy stays in the 09 §1 voice — name the fix.
 */
export function EmptyState({
  title,
  body,
  compact = false,
}: {
  title: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <View className="items-center gap-2 px-8 py-6">
      <Svg width={compact ? 48 : 72} height={compact ? 48 : 72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={30} stroke="#B3B8C2" strokeWidth={1.5} fill="none" />
        <Circle cx={36} cy={36} r={22} stroke="#D7DAE0" strokeWidth={1} fill="none" strokeDasharray="3 4" />
        <Path d="M36 10 L41 36 L36 62 L31 36 Z" fill="#F59E0B" opacity={0.9} />
        <Circle cx={36} cy={36} r={3} fill="#16181D" />
      </Svg>
      <DisplayText className={compact ? "text-h3 text-center" : "text-h2 text-center"}>{title}</DisplayText>
      {body ? <BodyText className="text-center text-text-secondary">{body}</BodyText> : null}
    </View>
  );
}
