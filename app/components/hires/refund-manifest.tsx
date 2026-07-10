// §7.6 refund preview — a receipt-style manifest for the cancel flow. Every
// figure is the server's *_display string rendered verbatim (never recomputed
// client-side). D-014-safe: refund figures are hirer-facing; no fee/payout.
import { View } from "react-native";

import type { RefundPreview } from "../../lib/types";
import { BodyText, Money, MonoText } from "../ui/text";

function Line({ label, display, minus = false }: { label: string; display: string; minus?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <BodyText className="text-body-sm text-text-secondary">{label}</BodyText>
      <MonoText className="text-body-sm text-text-primary">
        {minus ? "− " : ""}
        {display}
      </MonoText>
    </View>
  );
}

export function RefundManifest({ preview }: { preview: RefundPreview }) {
  return (
    <View className="gap-2 rounded-lg border border-border-default bg-surface-sunken p-4">
      <Line label="Hire value" display={preview.hire_value_display} />
      {preview.withheld_day > 0 ? (
        <Line label="Withheld day" display={preview.withheld_day_display} minus />
      ) : null}
      {preview.processing > 0 ? (
        <Line label="Processing" display={preview.processing_display} minus />
      ) : null}
      <View className="mt-1 flex-row items-center justify-between border-t border-border-default pt-2">
        <BodyText className="font-sans-semibold text-text-primary">You’ll be refunded</BodyText>
        <Money display={preview.amount_display} />
      </View>
      {preview.strike ? (
        <BodyText className="text-caption text-text-danger">
          Cancelling this late counts as a strike on your account.
        </BodyText>
      ) : null}
    </View>
  );
}
