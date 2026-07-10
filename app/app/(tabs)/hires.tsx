// S9 My Hires — tabs (Requested · Upcoming · On hire · History), HireCards
// with context strips, J8 "Hire again" atop History, pull-to-refresh + gentle
// poll (Ably realtime is 8E). Every hire state renders across the four tabs.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HireCard } from "../../components/hires/hire-card";
import { OfflineBanner } from "../../components/system/offline-banner";
import { OfflineNoCache } from "../../components/system/offline-no-cache";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText, DisplayText } from "../../components/ui/text";
import { HIRE_TABS } from "../../lib/hire-domain";
import { useHires } from "../../lib/queries";
import { useOffline } from "../../lib/use-offline";
import type { Hire } from "../../lib/types";

type TabKey = keyof typeof HIRE_TABS;

const TABS: { key: TabKey; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "upcoming", label: "Upcoming" },
  { key: "on_hire", label: "On hire" },
  { key: "history", label: "History" },
];

const EMPTY: Record<TabKey, { title: string; body: string }> = {
  requested: { title: "No open requests", body: "Requests you send appear here until a supplier responds." },
  upcoming: { title: "Nothing upcoming", body: "Accepted and confirmed hires wait here for their start date." },
  on_hire: { title: "Nothing on hire", body: "Assets you currently have on hire show here." },
  history: { title: "No past hires yet", body: "Completed and closed hires are kept here for your records." },
};

export default function HiresTab() {
  const insets = useSafeAreaInsets();
  const { data: hires, isLoading, refetch, isRefetching } = useHires();
  const offline = useOffline();
  const [tab, setTab] = useState<TabKey>("requested");

  const byTab = useMemo(() => {
    const groups = { requested: [], upcoming: [], on_hire: [], history: [] } as Record<TabKey, Hire[]>;
    for (const hire of hires ?? []) {
      for (const key of TABS.map((t) => t.key)) {
        if ((HIRE_TABS[key] as readonly string[]).includes(hire.status)) groups[key].push(hire);
      }
    }
    return groups;
  }, [hires]);

  const rows = byTab[tab];
  // J8 two-tap re-request: the most recent past hire, offered atop History.
  const hireAgain = tab === "history" ? rows[0] : undefined;

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2 pt-3">
        <DisplayText className="text-h1">Hires</DisplayText>
      </View>

      <View className="flex-row border-b border-border-default px-2">
        {TABS.map((t) => {
          const count = byTab[t.key].length;
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(t.key)}
              className={`flex-row items-center gap-1 px-3 py-3 ${active ? "border-b-2 border-surface-brand" : ""}`}
            >
              <BodyText
                className={`text-body-sm ${active ? "font-sans-semibold text-text-primary" : "text-text-secondary"}`}
              >
                {t.label}
              </BodyText>
              {count > 0 ? (
                <View className="rounded-full bg-surface-sunken px-1.5">
                  <BodyText className="text-caption text-text-secondary">{count}</BodyText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {hires ? <OfflineBanner /> : null}

      {offline && !hires ? (
        // S17 offline-no-cache: nothing persisted and no network to fetch.
        <OfflineNoCache onRetry={() => void refetch()} />
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(h) => h.id}
          renderItem={({ item }) => (
            <HireCard hire={item} onPress={() => router.push(`/hires/${item.id}` as never)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          contentContainerStyle={rows.length === 0 ? { flexGrow: 1, justifyContent: "center" } : undefined}
          ListHeaderComponent={
            hireAgain ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/hire-request/${hireAgain.listing_id}` as never)}
                className="flex-row items-center justify-between border-b border-border-default bg-surface-sunken px-4 py-3 active:opacity-80"
              >
                <View className="flex-1 pr-3">
                  <BodyText className="font-sans-semibold text-text-primary">Hire again</BodyText>
                  <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
                    {hireAgain.listing_title}
                  </BodyText>
                </View>
                <DisplayText className="text-h3 text-text-link">→</DisplayText>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={<EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body} />}
        />
      )}
    </View>
  );
}
