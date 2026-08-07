import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { Message } from "../../lib/types";
import { BodyText, MonoText } from "../ui/text";

function LockGlyph() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke="#78350F" strokeWidth={2.5} fill="none" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#78350F" strokeWidth={2.5} fill="none" />
    </Svg>
  );
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** B2B-hybrid squared bubble (V16): mine right/ink, theirs left/sunken; a
 *  masked message carries the 🔒 "contact hidden until paid" pill. */
export function MessageBubble({
  message,
  mine,
  pending = false,
  failed = false,
}: {
  message: Message;
  mine: boolean;
  pending?: boolean;
  failed?: boolean;
}) {
  return (
    <View className={`my-1 max-w-[82%] gap-0.5 ${mine ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-md px-3 py-2 ${mine ? "bg-surface-inverse" : "bg-surface-sunken"} ${pending ? "opacity-60" : ""}`}
      >
        <BodyText className={mine ? "text-text-inverse" : "text-text-primary"}>{message.body}</BodyText>
        {message.masked ? (
          <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-amber-100 px-2 py-0.5">
            <LockGlyph />
            <BodyText className="text-caption text-amber-900">contact hidden until paid</BodyText>
          </View>
        ) : null}
      </View>
      <MonoText className={`text-caption text-text-tertiary ${mine ? "self-end" : "self-start"}`}>
        {failed ? "not sent" : pending ? "sending…" : hhmm(message.sent_at)}
      </MonoText>
    </View>
  );
}
