// EventTimeline (06 §1) — the append-only hire event log, rendered to the
// hirer. Reads hire.events[] verbatim; the state machine is the only writer.
import { View } from "react-native";

import type { HireDetail } from "../../lib/types";
import { BodyText, MonoText } from "../ui/text";

const STEP_LABELS: Record<string, string> = {
  requested: "Request sent",
  accepted: "Accepted by supplier",
  confirmed: "Paid & confirmed",
  on_hire: "On hire",
  completed: "Completed",
  declined: "Declined",
  expired: "Request expired",
  cancelled: "Cancelled",
  in_dispute: "Dispute raised",
};

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventTimeline({ events }: { events: HireDetail["events"] }) {
  if (!events.length) return null;
  return (
    <View className="gap-3">
      <BodyText className="font-sans-semibold text-text-primary">Timeline</BodyText>
      <View className="gap-3">
        {events.map((e, i) => (
          <View key={e.id} className="flex-row gap-3">
            <View className="items-center">
              <View className={`mt-1 h-2.5 w-2.5 rounded-full ${i === events.length - 1 ? "bg-surface-brand" : "bg-ink-300"}`} />
              {i < events.length - 1 ? <View className="w-px flex-1 bg-border-default" /> : null}
            </View>
            <View className="flex-1 pb-1">
              <BodyText className="text-body-sm text-text-primary">
                {STEP_LABELS[e.to_status] ?? e.to_status}
              </BodyText>
              <MonoText className="text-caption text-text-tertiary">{when(e.created_at)}</MonoText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
