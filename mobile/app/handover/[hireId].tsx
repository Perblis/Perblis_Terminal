// S11 Handover Capture — camera-first evidence capture (≥2 photos), a class
// recipe reading, notes, then submit. Submit ENQUEUES to the D-016 offline
// queue (the one allowed offline mutation): it drains immediately when online
// or on reconnect, so a lost signal never loses a field capture. Skipping
// surfaces the dispute-weakening copy first (J3, §7.4).
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReadingPad, readingKindFor } from "../../components/hires/reading-pad";
import { Button } from "../../components/ui/button";
import { TextField } from "../../components/ui/text-field";
import { BodyText, DisplayText } from "../../components/ui/text";
import { hireKeys, useHire } from "../../lib/queries";
import type { CapturedPhoto } from "../../lib/media";
import { drainHandoverQueue, useHandoverQueue } from "../../stores/handover-queue";

export default function HandoverCapture() {
  const { hireId, kind } = useLocalSearchParams<{ hireId: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: hire } = useHire(hireId ?? null, undefined);

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [reading, setReading] = useState("");
  const [notes, setNotes] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!hire) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator />
      </View>
    );
  }

  const handoverKind = kind === "off_hire" ? "off_hire" : "on_hire";
  const readingKind = readingKindFor(hire.asset_class);
  const canSubmit = photos.length >= 2;

  const addFrom = async (source: "camera" | "library") => {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsMultipleSelection: true });
    if (result.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })),
    ]);
  };

  const submit = async () => {
    setSubmitting(true);
    const readingData: Record<string, unknown> = {};
    if (readingKind && reading) readingData[readingKind] = Number(reading);
    if (notes.trim()) readingData.notes = notes.trim();
    useHandoverQueue
      .getState()
      .enqueue({ hireId: hire.id, kind: handoverKind, photos, reading: readingData });
    setSubmitted(true);
    // Drain now if online; otherwise the shell drainer picks it up on reconnect.
    const ids = await drainHandoverQueue();
    for (const id of ids) {
      void qc.invalidateQueries({ queryKey: hireKeys.handovers(id) });
      void qc.invalidateQueries({ queryKey: hireKeys.detail(id) });
    }
    if (ids.length) void qc.invalidateQueries({ queryKey: hireKeys.all });
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-surface-page px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <DisplayText className="text-h2 text-center">Handover submitted</DisplayText>
        <BodyText className="text-center text-text-secondary">
          The supplier will confirm it. If you’re offline, it’ll upload automatically the moment
          you’re back online.
        </BodyText>
        <Button label="Back to the hire" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-page"
      style={{ paddingTop: insets.top }}
      behavior="padding"
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 20 }}>
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
            <DisplayText className="text-h3">←</DisplayText>
          </Pressable>
        </View>

        <View className="gap-1">
          <DisplayText className="text-h2">
            {handoverKind === "off_hire" ? "Off-hire handover" : "On-hire handover"}
          </DisplayText>
          <BodyText className="text-text-secondary">
            Take at least two photos of the asset’s condition. This is your evidence if anything is
            disputed later.
          </BodyText>
        </View>

        {/* Thumb rail */}
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`}>
                <Image source={{ uri: p.uri }} style={{ width: 96, height: 96, borderRadius: 8 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-surface-inverse"
                >
                  <BodyText className="text-caption text-text-inverse">✕</BodyText>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View className="gap-2">
          <Button label="Take photo" onPress={() => void addFrom("camera")} />
          <Button variant="secondary" label="Add from library" onPress={() => void addFrom("library")} />
          <BodyText className="text-caption text-text-tertiary">
            {photos.length}/2 minimum photos added
          </BodyText>
        </View>

        <ReadingPad kind={readingKind} value={reading} onChange={setReading} />

        <TextField
          label={readingKind ? "Notes (optional)" : "Condition / occupancy notes"}
          placeholder="Anything worth recording about the asset’s condition"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View className="gap-2">
          <Button label="Submit handover" busy={submitting} disabled={!canSubmit} onPress={() => void submit()} />
          <Button variant="ghost" label="Skip for now" onPress={() => setSkipOpen(true)} />
        </View>
      </ScrollView>

      {/* Skip → dispute-weakening warning (J3, §7.4). */}
      <Modal visible={skipOpen} transparent animationType="slide" onRequestClose={() => setSkipOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="gap-4 rounded-t-2xl bg-surface-page p-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <DisplayText className="text-h2">Skip the handover?</DisplayText>
            <BodyText className="text-text-secondary">
              Handover photos are your proof of the asset’s condition. If you skip and there’s a
              dispute later, not having a record weakens your position.
            </BodyText>
            <Button
              variant="secondary"
              label="Skip anyway"
              onPress={() => {
                setSkipOpen(false);
                router.back();
              }}
            />
            <Button variant="ghost" label="Keep capturing" onPress={() => setSkipOpen(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
