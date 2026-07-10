// S14 Messages — conversation list with all | enquiry | hire filter, unread
// pills + aggregate tab badge, pull-to-refresh + 15s poll (Ably overlays),
// chart-motif empty state. Renders cold from the persisted cache (8F posture).
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConversationRow } from "../../components/messaging/conversation-row";
import { EmptyState } from "../../components/ui/empty-state";
import { BodyText, DisplayText } from "../../components/ui/text";
import { useConversations } from "../../lib/queries";

type Filter = "all" | "enquiry" | "hire";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "enquiry", label: "Enquiries" },
  { key: "hire", label: "Hires" },
];

export default function MessagesTab() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useConversations();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return filter === "all" ? all : all.filter((c) => c.kind === filter);
  }, [data, filter]);

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2 pt-3">
        <DisplayText className="text-h1">Messages</DisplayText>
      </View>

      <View className="flex-row gap-2 px-4 pb-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 ${active ? "bg-surface-inverse" : "bg-surface-sunken"}`}
            >
              <BodyText
                className={`text-body-sm ${active ? "font-sans-semibold text-text-inverse" : "text-text-secondary"}`}
              >
                {f.label}
              </BodyText>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversationRow conv={item} onPress={() => router.push(`/messages/${item.id}` as never)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          contentContainerStyle={rows.length === 0 ? { flexGrow: 1, justifyContent: "center" } : undefined}
          ListEmptyComponent={
            <EmptyState
              title="No conversations yet"
              body="Message a supplier from a listing or storefront and it'll show up here."
            />
          }
        />
      )}
    </View>
  );
}
