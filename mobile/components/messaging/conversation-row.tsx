import { Image, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { resolveMediaUrl } from "../../lib/media";
import { relTime } from "../../lib/rel-time";
import { useThemeTokens } from "../../lib/theme";
import type { Conversation } from "../../lib/types";
import { BodyText } from "../ui/text";

function VerifiedTick() {
  const tk = useThemeTokens();
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M4 12 l5 5 L20 6" stroke={tk["--status-onHire"]} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** S14 conversation-list row (06 §7): counterparty, listing/general context,
 *  last-message preview + relative time, unread pill. */
export function ConversationRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const thumb = conv.listing?.thumb_url ? resolveMediaUrl(conv.listing.thumb_url) : null;
  const title = conv.listing?.title ?? "General enquiry";
  const preview = conv.last_message_preview ?? "No messages yet";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${conv.counterparty.name}`}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border-default bg-surface-card px-4 py-3 active:bg-surface-sunken"
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 52, height: 52, borderRadius: 8 }} />
      ) : (
        <View className="h-[52px] w-[52px] items-center justify-center rounded-lg bg-surface-sunken">
          <BodyText className="text-caption text-text-tertiary">GEN</BodyText>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-1">
            <BodyText className="flex-shrink font-sans-semibold text-text-primary" numberOfLines={1}>
              {conv.counterparty.name}
            </BodyText>
            {conv.counterparty.verified ? <VerifiedTick /> : null}
          </View>
          <BodyText className="text-caption text-text-tertiary">{relTime(conv.last_message_at)}</BodyText>
        </View>
        <BodyText className="text-body-sm text-text-secondary" numberOfLines={1}>
          {title}
        </BodyText>
        <View className="flex-row items-center justify-between gap-2">
          <BodyText className="flex-1 text-body-sm text-text-tertiary" numberOfLines={1}>
            {preview}
          </BodyText>
          {conv.unread_count > 0 ? (
            <View className="min-w-5 items-center rounded-full bg-surface-brand px-1.5">
              <BodyText className="text-caption font-sans-semibold text-text-on-brand">
                {conv.unread_count}
              </BodyText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
