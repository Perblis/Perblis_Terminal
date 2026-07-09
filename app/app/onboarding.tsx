import { router } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChartTease } from "../components/brand/chart-tease";
import { HazardStripe } from "../components/brand/hazard-stripe";
import { PlateLockup } from "../components/brand/lockup";
import { BodyText, DisplayText } from "../components/ui/text";
import { useOnboarding } from "../stores/onboarding";

// S1 onboarding (ux/02): ① value prop ② how it works ③ role note.
// Copy per the screen spec; the chart tease backdrop is vision V3.
const PAGES = [
  {
    key: "value",
    title: "Find heavy assets near your site",
    body: "Excavators, trucks, warehouses, terminals and land — mapped around you, priced upfront.",
  },
  {
    key: "how",
    title: "Discover → request → pay safely",
    body: "Pick dates, see one total, and pay through Terminal. Your money moves when the machine does.",
  },
  {
    key: "role",
    title: "Suppliers manage on the web",
    body: "This app is for hiring. Run listings, yards and payouts from the Terminal portal on your computer.",
  },
] as const;

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const complete = useOnboarding((s) => s.complete);

  const finish = (to: "/auth/register" | "/(tabs)") => {
    complete();
    router.replace(to);
  };

  return (
    <View className="flex-1 bg-surface-inverse">
      <ChartTease />
      <View className="flex-1" style={{ paddingTop: insets.top + 24 }}>
        <View className="items-center">
          <PlateLockup size="sm" />
        </View>

        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(p) => p.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width }} className="justify-end px-6 pb-8">
              <DisplayText className="text-display-lg text-text-inverse">{item.title}</DisplayText>
              <BodyText className="mt-3 text-body-lg text-ink-300">{item.body}</BodyText>
            </View>
          )}
        />

        {/* dots */}
        <View className="mb-4 flex-row justify-center gap-2">
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              className={`h-1.5 rounded-full ${i === page ? "w-6 bg-surface-brand" : "w-1.5 bg-ink-600"}`}
            />
          ))}
        </View>

        <View className="gap-3 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
          {page < PAGES.length - 1 ? (
            <>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-md bg-surface-brand px-6 py-3.5 active:opacity-90"
                onPress={() => listRef.current?.scrollToIndex({ index: page + 1, animated: true })}
              >
                <BodyText className="font-sans-semibold text-text-on-brand">Next</BodyText>
              </Pressable>
              {/* Skippable after ① (FSD §6) */}
              {page >= 1 && (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-12 items-center justify-center py-3"
                  onPress={() => finish("/(tabs)")}
                >
                  <BodyText className="text-ink-300">Skip — browse the map</BodyText>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-md bg-surface-brand px-6 py-3.5 active:opacity-90"
                onPress={() => finish("/auth/register")}
              >
                <BodyText className="font-sans-semibold text-text-on-brand">Create an account</BodyText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 items-center justify-center py-3"
                onPress={() => finish("/(tabs)")}
              >
                <BodyText className="text-ink-300">Browse as a guest</BodyText>
              </Pressable>
            </>
          )}
        </View>
        <HazardStripe />
      </View>
    </View>
  );
}
