// S15 Conversation — B2B-hybrid thread: date separators, inline system status,
// MaskedContact chips + first-occurrence explainer, optimistic send with per-
// message retry; Ably (conv:{id}) overlays the 15s poll. Header context chip
// deep-links to the listing (enquiry) or the hire (S10).
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Composer } from "../../components/messaging/composer";
import { MessageBubble } from "../../components/messaging/message-bubble";
import { BodyText, DisplayText } from "../../components/ui/text";
import { useConversations, useMarkRead, useMessages, useSendMessage } from "../../lib/queries";
import { useRealtimeChannel } from "../../lib/realtime";
import { playMessageReceived } from "../../lib/sounds";
import type { Message } from "../../lib/types";
import { useSession } from "../../stores/session";

type Pending = { key: string; body: string; failed: boolean };

type Row =
  | { k: "date"; label: string }
  | { k: "sys"; label: string }
  | { k: "banner" }
  | { k: "msg"; m: Message }
  | { k: "pending"; p: Pending };

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = id ?? null;
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);

  const { data: conversations } = useConversations();
  const conv = conversations?.results.find((c) => c.id === id);
  const { data: messages } = useMessages(conversationId);
  const send = useSendMessage(id ?? "");
  const markRead = useMarkRead(id ?? "");

  const [pending, setPending] = useState<Pending[]>([]);
  const keySeq = useRef(0);

  // Ably conv channel overlays polling; a fire just triggers a refetch.
  useRealtimeChannel(conversationId ? `conv:${id}` : null, () => {
    void markRead.mutate();
  });

  // Mark read on open + whenever the thread grows.
  const count = messages?.length ?? 0;
  useEffect(() => {
    if (conversationId && count > 0) markRead.mutate();
    // markRead identity is stable enough; fire on count change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, count]);

  // Play the receive sound when a new INBOUND message lands (poll or realtime);
  // never on first hydration or for the hirer's own sends (V10; V8: no haptic).
  const lastSeenId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const last = messages && messages.length ? messages[messages.length - 1] : undefined;
    if (!last) return;
    if (lastSeenId.current !== undefined && last.id !== lastSeenId.current && last.sender_id !== me?.id) {
      playMessageReceived();
    }
    lastSeenId.current = last.id;
  }, [messages, me?.id]);

  const submit = (body: string) => {
    const key = `p${keySeq.current++}`;
    setPending((p) => [...p, { key, body, failed: false }]);
    fire(key, body);
  };
  const fire = (key: string, body: string) => {
    setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: false } : x)));
    send.mutate(body, {
      onSuccess: () => setPending((p) => p.filter((x) => x.key !== key)),
      onError: () => setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x))),
    });
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (conv?.kind === "hire" && conv.unlocked) out.push({ k: "sys", label: "Contact details unlocked" });
    let lastDay: string | null = null;
    let bannerShown = false;
    for (const m of messages ?? []) {
      const d = dayLabel(m.sent_at);
      if (d !== lastDay) {
        out.push({ k: "date", label: d });
        lastDay = d;
      }
      if (m.masked && !bannerShown) {
        out.push({ k: "banner" });
        bannerShown = true;
      }
      out.push({ k: "msg", m });
    }
    for (const p of pending) out.push({ k: "pending", p });
    return out;
  }, [conv, messages, pending]);

  const contextLabel =
    conv?.kind === "hire"
      ? "Hire conversation"
      : conv?.listing
        ? `Enquiry · ${conv.listing.title}`
        : "General enquiry";
  const onContext = () => {
    if (conv?.kind === "hire" && conv.hire_id) router.push(`/hires/${conv.hire_id}` as never);
    else if (conv?.listing) router.push(`/listing/${conv.listing.id}` as never);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-page"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-row items-center gap-3 border-b border-border-default px-4 py-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
          <DisplayText className="text-h3">←</DisplayText>
        </Pressable>
        <View className="flex-1">
          <BodyText className="font-sans-semibold text-text-primary" numberOfLines={1}>
            {conv?.counterparty.name ?? "Conversation"}
          </BodyText>
          <Pressable accessibilityRole="button" onPress={onContext}>
            <BodyText className="text-caption text-text-link" numberOfLines={1}>
              {contextLabel}
              {conv?.yard_name ? ` · ${conv.yard_name}` : ""}
            </BodyText>
          </Pressable>
        </View>
      </View>

      {!messages ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          data={rows}
          keyExtractor={(r, i) =>
            r.k === "msg" ? r.m.id : r.k === "pending" ? r.p.key : `${r.k}-${i}`
          }
          renderItem={({ item }) => {
            if (item.k === "date")
              return (
                <BodyText className="my-3 self-center text-caption text-text-tertiary">{item.label}</BodyText>
              );
            if (item.k === "sys")
              return (
                <BodyText className="my-2 self-center rounded-full bg-surface-sunken px-3 py-1 text-caption text-text-secondary">
                  🔓 {item.label}
                </BodyText>
              );
            if (item.k === "banner")
              return (
                <View className="my-2 rounded-lg bg-amber-100 px-3 py-2">
                  <BodyText className="text-caption text-amber-900">
                    Numbers unlock after payment — Terminal protects both parties.
                  </BodyText>
                </View>
              );
            if (item.k === "pending")
              return (
                <View className="my-1 max-w-[82%] gap-1 self-end">
                  <MessageBubble
                    message={{ id: item.p.key, conversation_id: id ?? "", sender_id: me?.id ?? "", body: item.p.body, masked: false, sent_at: "", read_at: null }}
                    mine
                    pending
                    failed={item.p.failed}
                  />
                  {item.p.failed ? (
                    <Pressable accessibilityRole="button" onPress={() => fire(item.p.key, item.p.body)} className="self-end">
                      <BodyText className="text-caption text-text-danger">Message didn’t send. Retry</BodyText>
                    </Pressable>
                  ) : null}
                </View>
              );
            return <MessageBubble message={item.m} mine={item.m.sender_id === me?.id} />;
          }}
        />
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <Composer onSend={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
