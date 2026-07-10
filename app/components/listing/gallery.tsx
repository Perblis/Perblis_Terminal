// S6 immersive hero gallery (V13): full-bleed 16:10 pager bleeding behind
// the status bar, counter chip, M4 corner marks on the first photo, and a
// thumbnail rail. The machine as showpiece.
import { useRef, useState } from "react";
import { FlatList, Image, Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { resolveMediaUrl } from "../../lib/media";
import type { ListingPhoto } from "../../lib/types";
import { MonoText } from "../ui/text";

function CornerMarks() {
  const arm = "M1 13 V1 H13";
  const positions = [
    { left: 10, top: 10, rotate: "0deg" },
    { right: 10, top: 10, rotate: "90deg" },
    { right: 10, bottom: 10, rotate: "180deg" },
    { left: 10, bottom: 10, rotate: "270deg" },
  ] as const;
  return (
    <View className="absolute inset-0" pointerEvents="none">
      {positions.map((pos, i) => (
        <View key={i} className="absolute" style={{ ...pos, transform: [{ rotate: pos.rotate }] }}>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d={arm} stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} fill="none" />
          </Svg>
        </View>
      ))}
    </View>
  );
}

export function Gallery({ photos, topInset }: { photos: ListingPhoto[]; topInset: number }) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.625); // 16:10
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const ordered = [...photos].sort((a, b) => a.position - b.position);

  if (ordered.length === 0) {
    return (
      // Fixed ink letterbox — the immersive gallery stays dark in both themes.
      <View className="items-center justify-center bg-ink-900" style={{ height: height + topInset, paddingTop: topInset }}>
        <MonoText className="text-body text-amber-500">No photos yet</MonoText>
      </View>
    );
  }

  return (
    <View style={{ height: height + topInset }} className="bg-ink-900">
      <FlatList
        ref={listRef}
        data={ordered}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height: height + topInset }}>
            <Image
              source={{ uri: resolveMediaUrl(item.url) }}
              style={{ width, height: height + topInset }}
              resizeMode="cover"
            />
            {i === 0 ? <CornerMarks /> : null}
          </View>
        )}
      />
      {/* counter chip */}
      <View className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1">
        <MonoText className="text-caption" style={{ color: "#FFFFFF" }}>
          {index + 1}/{ordered.length}
        </MonoText>
      </View>
      {/* thumbnail rail */}
      {ordered.length > 1 ? (
        <View className="absolute bottom-3 left-3 flex-row gap-1.5">
          {ordered.slice(0, 6).map((p, i) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1}`}
              onPress={() => {
                listRef.current?.scrollToIndex({ index: i, animated: true });
                setIndex(i);
              }}
            >
              <Image
                source={{ uri: resolveMediaUrl(p.url) }}
                style={{
                  width: 36,
                  height: 27,
                  borderRadius: 4,
                  borderWidth: i === index ? 1.5 : 0,
                  borderColor: "#F59E0B",
                  opacity: i === index ? 1 : 0.7,
                }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
