// Handover evidence thumbnails + lightbox (S10) — mirrors the portal's
// handover-evidence viewer. Photos are private-bucket (D-025): the record
// carries short-lived presigned GETs in `photo_urls` (same order as the
// `photos` keys), so URLs render directly and are refetched with the record
// rather than cached. Purged records (D-026) show a retention note instead.
import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";

import type { HandoverRecord } from "../../lib/types";
import { resolveMediaUrl } from "../../lib/media";
import { BodyText, DisplayText, MonoText } from "../ui/text";

const THUMB = 72;

export function HandoverPhotoStrip({ record }: { record: HandoverRecord }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const urls = record.photo_urls.map(resolveMediaUrl);

  if (record.photos_purged_at !== null) {
    return (
      <BodyText className="text-caption text-text-tertiary">
        Photos were removed 90 days after off-hire — the readings and confirmations above remain
        on record.
      </BodyText>
    );
  }
  if (urls.length === 0) return null;

  const shown = openIndex ?? 0;
  const step = (delta: number) =>
    setOpenIndex((i) => (i === null ? null : (i + delta + urls.length) % urls.length));

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {urls.map((url, i) =>
          broken[i] ? (
            <View
              key={url}
              style={{ width: THUMB, height: THUMB }}
              className="items-center justify-center rounded-md bg-surface-sunken"
            >
              <BodyText className="text-caption text-text-tertiary">No photo</BodyText>
            </View>
          ) : (
            <Pressable
              key={url}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Handover photo ${i + 1} of ${urls.length}`}
              onPress={() => setOpenIndex(i)}
            >
              <Image
                source={{ uri: url }}
                style={{ width: THUMB, height: THUMB, borderRadius: 6 }}
                onError={() => setBroken((b) => ({ ...b, [i]: true }))}
              />
            </Pressable>
          ),
        )}
      </ScrollView>

      <Modal
        visible={openIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenIndex(null)}
      >
        <View className="flex-1 justify-center bg-black/90">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
            className="absolute right-5 top-14 z-10 p-2"
            onPress={() => setOpenIndex(null)}
          >
            <DisplayText className="text-h2 text-white">✕</DisplayText>
          </Pressable>
          <Image
            source={{ uri: urls[shown] }}
            style={{ width: "100%", height: "70%" }}
            resizeMode="contain"
          />
          <View className="flex-row items-center justify-center gap-8 pt-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              hitSlop={12}
              onPress={() => step(-1)}
            >
              <DisplayText className="text-h2 text-white">‹</DisplayText>
            </Pressable>
            <MonoText className="text-body-sm text-white">
              {shown + 1} / {urls.length}
            </MonoText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              hitSlop={12}
              onPress={() => step(1)}
            >
              <DisplayText className="text-h2 text-white">›</DisplayText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
