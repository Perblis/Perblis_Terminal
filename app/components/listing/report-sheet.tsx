// F10 report sheet (from S6 overflow): reason select + optional detail + SLA
// copy. After submit we show a plain thank-you and NO status — the reporter
// never sees downstream state (anti-gaming). Throttle is server-side (5/day).
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReportListing } from "../../lib/queries";
import { Button } from "../ui/button";
import { TextField } from "../ui/text-field";
import { BodyText, DisplayText } from "../ui/text";

const REASONS: { value: string; label: string }[] = [
  { value: "fraudulent", label: "Fraudulent or a scam" },
  { value: "inaccurate", label: "Inaccurate details" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "unavailable", label: "Not actually available" },
];

export function ReportSheet({
  listingId,
  visible,
  onClose,
}: {
  listingId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const report = useReportListing(listingId);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    // reset after the sheet is dismissed
    setReason(null);
    setNote("");
    setDone(false);
  };

  const submit = () => {
    if (!reason) return;
    report.mutate({ reason, note: note.trim() || undefined }, { onSuccess: () => setDone(true) });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <KeyboardAvoidingView behavior="padding">
        <View className="gap-4 rounded-t-2xl bg-surface-page p-6" style={{ paddingBottom: insets.bottom + 24 }}>
          {done ? (
            <>
              <DisplayText className="text-h2">Thanks — we’ll take a look</DisplayText>
              <BodyText className="text-text-secondary">
                Our team reviews reports and acts where needed. We don’t share outcomes, but every
                report helps keep Terminal safe.
              </BodyText>
              <Button label="Done" onPress={close} />
            </>
          ) : (
            <>
              <DisplayText className="text-h2">Report this listing</DisplayText>
              <View className="gap-2">
                {REASONS.map((r) => {
                  const active = reason === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setReason(r.value)}
                      className={`rounded-md border px-4 py-3 ${active ? "border-surface-brand bg-amber-100" : "border-border-strong bg-surface-card"}`}
                    >
                      <BodyText className={active ? "font-sans-semibold text-amber-900" : "text-text-primary"}>
                        {r.label}
                      </BodyText>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="Anything else? (optional)"
                placeholder="Add any detail that helps us review"
                value={note}
                onChangeText={setNote}
                multiline
              />
              <BodyText className="text-caption text-text-tertiary">
                We review reports within 2 business days.
              </BodyText>
              <Button label="Submit report" busy={report.isPending} disabled={!reason} onPress={submit} />
              <Button variant="ghost" label="Cancel" onPress={close} />
            </>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
