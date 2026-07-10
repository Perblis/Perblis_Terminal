// A handover record card on S10. The COUNTERPARTY confirms (never the
// submitter, hires/state.py) — so the hirer sees "Confirm" only on a
// supplier-submitted, unconfirmed record; their own unconfirmed record shows
// "awaiting supplier". Photos are private-bucket keys (viewer needs a
// presigned GET the record doesn't carry), so we show a count, not thumbs.
import { View } from "react-native";

import type { HandoverRecord } from "../../lib/types";
import { Button } from "../ui/button";
import { BodyText, MonoText } from "../ui/text";

const KIND_LABEL: Record<HandoverRecord["kind"], string> = {
  on_hire: "On-hire handover",
  off_hire: "Off-hire handover",
};

const READING_LABEL: Record<string, string> = {
  hour_meter: "Hour meter",
  odometer: "Odometer",
};

function readingLines(reading: Record<string, unknown>): string[] {
  return Object.entries(reading).map(
    ([k, v]) => `${READING_LABEL[k] ?? k.replace(/_/g, " ")}: ${String(v)}`,
  );
}

export function HandoverRecordCard({
  record,
  onConfirm,
  confirming,
}: {
  record: HandoverRecord;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const confirmed = record.confirmed_at !== null;
  const hirerCanConfirm = !confirmed && record.submitted_by_role === "supplier";
  const lines = readingLines(record.reading);

  return (
    <View className="gap-2 rounded-lg border border-border-default bg-surface-card p-4">
      <View className="flex-row items-center justify-between">
        <BodyText className="font-sans-semibold text-text-primary">{KIND_LABEL[record.kind]}</BodyText>
        {confirmed ? (
          <BodyText className="text-caption font-sans-semibold text-green-900">Confirmed ✓✓</BodyText>
        ) : (
          <BodyText className="text-caption text-text-tertiary">Awaiting confirmation</BodyText>
        )}
      </View>

      <BodyText className="text-body-sm text-text-secondary">
        {record.photos.length} photo{record.photos.length === 1 ? "" : "s"} attached
      </BodyText>
      {lines.map((line) => (
        <MonoText key={line} className="text-body-sm text-text-secondary">
          {line}
        </MonoText>
      ))}

      {hirerCanConfirm ? (
        <Button label="Confirm handover" busy={confirming} onPress={onConfirm} />
      ) : !confirmed && record.submitted_by_role === "hirer" ? (
        <BodyText className="text-caption text-text-tertiary">
          Awaiting the supplier to confirm your record.
        </BodyText>
      ) : null}
    </View>
  );
}
