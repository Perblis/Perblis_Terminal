// LockedTerms, hirer variant — the vault panel (V11, D-021 motif to
// mobile): corner-bracket ink panel, lock glyph, mono dates, and the
// OVERSIZED server hire_value_display. D-014's one app home: the hirer
// sees exactly one figure — the total they pay. Server strings verbatim.
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { formatDateRange } from "../../lib/hire-domain";
import type { Hire } from "../../lib/types";
import { BodyText, Money, MonoText } from "../ui/text";

function Bracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos = {
    tl: { left: 6, top: 6, rotate: "0deg" },
    tr: { right: 6, top: 6, rotate: "90deg" },
    br: { right: 6, bottom: 6, rotate: "180deg" },
    bl: { left: 6, bottom: 6, rotate: "270deg" },
  }[corner];
  return (
    <View className="absolute" style={{ ...pos, transform: [{ rotate: pos.rotate }] }}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path d="M1 13 V1 H13" stroke="#F59E0B" strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

function LockGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Rect x={5} y={10} width={14} height={10} rx={2} stroke="#B3B8C2" strokeWidth={2} fill="none" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#B3B8C2" strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function LockedTerms({ hire }: { hire: Hire }) {
  return (
    // Fixed ink vault: the panel's brackets/lock/captions are drawn for a
    // dark plate, so it stays ink in both themes rather than flipping with
    // surface-inverse.
    <View className="rounded-lg bg-ink-900 p-6">
      <Bracket corner="tl" />
      <Bracket corner="tr" />
      <Bracket corner="bl" />
      <Bracket corner="br" />
      <View className="items-center gap-3">
        <View className="flex-row items-center gap-1.5">
          <LockGlyph />
          <BodyText className="text-caption text-ink-300">Terms locked at acceptance</BodyText>
        </View>
        <View className="items-center">
          <BodyText className="text-body-sm text-ink-300">You pay</BodyText>
          <Money display={hire.hire_value_display} hero className="text-paper-0" />
        </View>
        <MonoText className="text-body-sm text-ink-300">
          {formatDateRange(hire.start_date, hire.end_date, hire.duration_days)}
        </MonoText>
      </View>
    </View>
  );
}
