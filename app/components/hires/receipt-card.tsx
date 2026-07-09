// The receipt share artefact (V9): plate lockup, PAID stamp, mono total,
// corner brackets, QR deep-link back to the listing. Captured with
// view-shot and shared — every WhatsApp share is an ad. NO FEE LINES EVER
// (D-014); the only figure is the server hire_value_display.
import { forwardRef } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path } from "react-native-svg";

import { formatDateRange } from "../../lib/hire-domain";
import type { Hire } from "../../lib/types";
import { PlateLockup } from "../brand/lockup";
import { HazardStripe } from "../brand/hazard-stripe";
import { BodyText, DisplayText, Money, MonoText } from "../ui/text";

function Bracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos = {
    tl: { left: 8, top: 8, rotate: "0deg" },
    tr: { right: 8, top: 8, rotate: "90deg" },
    br: { right: 8, bottom: 8, rotate: "180deg" },
    bl: { left: 8, bottom: 8, rotate: "270deg" },
  }[corner];
  return (
    <View className="absolute" style={{ ...pos, transform: [{ rotate: pos.rotate }] }}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path d="M1 13 V1 H13" stroke="#D7DAE0" strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

export const ReceiptCard = forwardRef<View, { hire: Hire }>(function ReceiptCard({ hire }, ref) {
  return (
    <View ref={ref} collapsable={false} className="overflow-hidden rounded-lg bg-surface-inverse">
      <View className="items-center gap-4 px-6 pb-5 pt-6">
        <Bracket corner="tl" />
        <Bracket corner="tr" />
        <Bracket corner="bl" />
        <Bracket corner="br" />
        <PlateLockup size="sm" />
        {/* static PAID stamp (final state — the animated moment already played) */}
        <View
          className="items-center justify-center rounded-md"
          style={{ borderWidth: 3, borderColor: "#F59E0B", width: 96, height: 42, transform: [{ rotate: "-6deg" }] }}
        >
          <DisplayText className="font-display-bold tracking-widest" style={{ color: "#F59E0B", fontSize: 20 }}>
            PAID
          </DisplayText>
        </View>
        <View className="items-center gap-1">
          <BodyText className="text-body-sm text-ink-300" numberOfLines={1}>
            {hire.listing_title}
          </BodyText>
          <Money display={hire.hire_value_display} hero className="text-text-inverse" />
          <MonoText className="text-body-sm text-ink-300">
            {formatDateRange(hire.start_date, hire.end_date, hire.duration_days)}
          </MonoText>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="rounded-md bg-white p-1.5">
            <QRCode value={`https://terminal.ng/l/${hire.listing_id}`} size={56} />
          </View>
          <View className="flex-1">
            <BodyText className="text-caption text-ink-300">
              Hire heavy assets near your site — scan to see this machine on Terminal.
            </BodyText>
            <MonoText className="text-caption text-ink-500">ref {hire.id.slice(0, 8)}</MonoText>
          </View>
        </View>
      </View>
      <HazardStripe height={6} />
    </View>
  );
});
