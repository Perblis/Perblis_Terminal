// F2 verification — submit identity or business documents (multipart, direct
// upload per TSD §3.9). Reached from the S7 cap gate and the S16 Profile card.
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/ui/button";
import { KeyboardSpacer } from "../components/ui/keyboard-spacer";
import { TextField } from "../components/ui/text-field";
import { BodyText, DisplayText } from "../components/ui/text";
import { useSubmitVerification } from "../lib/queries";

type Kind = "identity" | "business";

export default function Verify() {
  const insets = useSafeAreaInsets();
  const submit = useSubmitVerification();
  const [kind, setKind] = useState<Kind>("identity");
  const [rc, setRc] = useState("");
  const [docs, setDocs] = useState<{ uri: string }[]>([]);
  const [done, setDone] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true });
    if (result.canceled) return;
    setDocs((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))].slice(0, 5));
  };

  const canSubmit = docs.length > 0 && (kind !== "business" || rc.trim().length > 0);

  const onSubmit = () => {
    const form = new FormData();
    form.append("kind", kind);
    if (kind === "business") form.append("rc_number", rc.trim());
    docs.forEach((d, i) =>
      // RN FormData file part
      form.append("documents", { uri: d.uri, name: `doc-${i}.jpg`, type: "image/jpeg" } as unknown as Blob),
    );
    submit.mutate(form, { onSuccess: () => setDone(true) });
  };

  if (done) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-surface-page px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <DisplayText className="text-h2 text-center">Documents submitted</DisplayText>
        <BodyText className="text-center text-text-secondary">
          Our team reviews within 1 business day. We’ll let you know the outcome.
        </BodyText>
        <Button label="Back to profile" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 18 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
          <DisplayText className="text-h3">←</DisplayText>
        </Pressable>
        <DisplayText className="text-h2">Verify your account</DisplayText>
        <BodyText className="text-text-secondary">
          Verified accounts can request hires above the Basic limit. Upload a clear photo of your
          document.
        </BodyText>

        <View className="flex-row gap-2">
          {(["identity", "business"] as Kind[]).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              onPress={() => setKind(k)}
              className={`flex-1 items-center rounded-md border px-3 py-3 ${kind === k ? "border-surface-brand bg-amber-100" : "border-border-strong bg-surface-card"}`}
            >
              <BodyText className={kind === k ? "font-sans-semibold text-amber-900" : "text-text-secondary"}>
                {k === "identity" ? "Personal ID" : "Business (CAC)"}
              </BodyText>
            </Pressable>
          ))}
        </View>

        {kind === "business" ? (
          <TextField label="RC number" placeholder="e.g. RC 1234567" value={rc} onChangeText={setRc} />
        ) : null}

        {docs.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {docs.map((d, i) => (
              <Image key={`${d.uri}-${i}`} source={{ uri: d.uri }} style={{ width: 96, height: 96, borderRadius: 8 }} />
            ))}
          </ScrollView>
        ) : null}

        <Button variant="secondary" label="Add document" onPress={() => void pick()} />
        <Button label="Submit for review" busy={submit.isPending} disabled={!canSubmit} onPress={onSubmit} />
        <KeyboardSpacer />
      </ScrollView>
    </View>
  );
}
