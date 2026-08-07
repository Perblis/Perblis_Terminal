import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { HireStatus7 } from "../../lib/types";
import { BodyText } from "../ui/text";

// Hire status badges per 02 §4 + the 09 §3 status vocabulary. On Hire is
// deliberately the only solid badge. Labels are HIRER-facing (distinct from
// the supplier's — e.g. accepted = "Pay now", not "Awaiting payment").
const STYLES: Record<HireStatus7, { frame: string; text: string }> = {
  requested: { frame: "bg-amber-500/12", text: "text-amber-300" },
  accepted: { frame: "bg-blue-400/12", text: "text-blue-300" },
  confirmed: { frame: "bg-teal-400/12", text: "text-teal-300" },
  on_hire: { frame: "bg-green-500", text: "text-text-primary" },
  completed: { frame: "bg-surface-sunken", text: "text-text-secondary" },
  declined: { frame: "border border-border-default", text: "text-text-tertiary" },
  expired: { frame: "border border-border-default", text: "text-text-tertiary" },
  cancelled: { frame: "bg-red-500/12", text: "text-red-300" },
  in_dispute: { frame: "bg-violet-400/12", text: "text-violet-300" },
};

const LABELS: Record<HireStatus7, string> = {
  requested: "Requested",
  accepted: "Pay now",
  confirmed: "Confirmed",
  on_hire: "On hire",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  in_dispute: "In dispute",
};

function LockGlyph() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke="#B056F0" strokeWidth={2.5} fill="none" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#B056F0" strokeWidth={2.5} fill="none" />
    </Svg>
  );
}

export function StatusBadge({ status }: { status: HireStatus7 }) {
  const s = STYLES[status];
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-0.5 ${s.frame}`}>
      {status === "in_dispute" ? <LockGlyph /> : null}
      <BodyText className={`text-caption font-sans-semibold ${s.text}`}>{LABELS[status]}</BodyText>
    </View>
  );
}
