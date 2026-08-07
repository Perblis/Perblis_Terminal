// The receipt share artefact (V9): a formal transaction record — plate
// lockup, labelled document rows, mono total, a restrained PAID marker, QR
// deep-link back to the listing. Captured with view-shot and shared — every
// WhatsApp share is an ad, so it must read like a serious document, not a
// sticker. NO FEE LINES EVER (D-014); the only figure is the server
// hire_value_display.
import { forwardRef } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path } from "react-native-svg";

import { formatDateRange } from "../../lib/hire-domain";
import type { Hire } from "../../lib/types";
import { PlateLockup } from "../brand/lockup";
import { HazardStripe } from "../brand/hazard-stripe";
import { BodyText, Money, MonoText } from "../ui/text";

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

// Fixed-plate hairline (ink-700 on the ink-900 artefact — theme-independent).
function Rule() {
  return <View className="h-px w-full" style={{ backgroundColor: "#3A3F49" }} />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline gap-4">
      <BodyText className="w-24 text-overline tracking-widest text-ink-500">{label}</BodyText>
      <MonoText className="flex-1 text-right text-body-sm text-paper-0" numberOfLines={1}>
        {value}
      </MonoText>
    </View>
  );
}

type ReceiptHire = Hire & { events?: { to_status: string; created_at: string }[] };

export const ReceiptCard = forwardRef<View, { hire: ReceiptHire }>(function ReceiptCard(
  { hire },
  ref,
) {
  // The confirmed transition IS the payment moment; fall back to the request
  // date only if the events haven't hydrated (cosmetic — the ref stays true).
  const paidAt = hire.events?.find((e) => e.to_status === "confirmed")?.created_at;
  const issued = new Date(paidAt ?? hire.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    // Fixed ink plate: the artefact is captured and shared as an image, so it
    // must render identically in both themes (surface-inverse flips to paper
    // in dark and would invert the whole receipt).
    <View ref={ref} collapsable={false} className="w-full overflow-hidden rounded-lg bg-ink-900">
      <View className="gap-4 px-6 pb-5 pt-6">
        <Bracket corner="tl" />
        <Bracket corner="tr" />
        <Bracket corner="bl" />
        <Bracket corner="br" />

        <View className="items-center gap-1.5">
          <PlateLockup size="sm" />
          <BodyText className="text-overline tracking-widest text-ink-400">
            OFFICIAL RECEIPT
          </BodyText>
        </View>

        <Rule />

        <View className="gap-2">
          <Row label="ASSET" value={hire.listing_title} />
          <Row label="PERIOD" value={formatDateRange(hire.start_date, hire.end_date, hire.duration_days)} />
          <Row label="REFERENCE" value={`T-${hire.id.slice(0, 8).toUpperCase()}`} />
          <Row label="ISSUED" value={issued} />
        </View>

        <Rule />

        <View className="flex-row items-end justify-between gap-3">
          <View className="gap-0.5">
            <BodyText className="text-overline tracking-widest text-ink-500">TOTAL PAID</BodyText>
            <Money display={hire.hire_value_display} hero className="text-paper-0" />
          </View>
          {/* restrained document status marker — squared, unrotated */}
          <View className="rounded-sm border px-2.5 py-1" style={{ borderColor: "#F59E0B" }}>
            <MonoText className="text-caption tracking-widest" style={{ color: "#F59E0B" }}>
              PAID
            </MonoText>
          </View>
        </View>

        <Rule />

        <View className="flex-row items-center gap-3">
          <View className="rounded-md bg-white p-1.5">
            <QRCode value={`https://terminal.ng/l/${hire.listing_id}`} size={56} />
          </View>
          <View className="flex-1">
            <BodyText className="text-caption text-ink-300">
              Hire heavy assets near your site — scan to see this machine on Terminal.
            </BodyText>
            <MonoText className="text-caption text-ink-500">terminal.ng</MonoText>
          </View>
        </View>
      </View>
      <HazardStripe height={6} />
    </View>
  );
});
