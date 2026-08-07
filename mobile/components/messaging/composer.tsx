import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useThemeTokens } from "../../lib/theme";
import { BodyText } from "../ui/text";

/** Message composer — multiline input + send. Draft clears before send (the
 *  screen owns the optimistic pending bubble). No send haptic (V8). */
export function Composer({ onSend }: { onSend: (body: string) => void }) {
  const tk = useThemeTokens();
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;
  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    onSend(body);
  };
  return (
    <View className="flex-row items-end gap-2 border-t border-border-default bg-surface-card px-3 py-2">
      <TextInput
        className="max-h-28 flex-1 rounded-md border border-border-strong bg-surface-page px-3 py-2 font-sans text-body text-text-primary"
        placeholder="Message"
        placeholderTextColor={tk["--text-tertiary"]}
        value={draft}
        onChangeText={setDraft}
        multiline
        accessibilityLabel="Message"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={submit}
        disabled={!canSend}
        className={`h-11 items-center justify-center rounded-md px-4 ${canSend ? "bg-surface-brand" : "bg-surface-sunken"}`}
      >
        <BodyText className={canSend ? "font-sans-semibold text-text-on-brand" : "text-text-tertiary"}>
          Send
        </BodyText>
      </Pressable>
    </View>
  );
}
