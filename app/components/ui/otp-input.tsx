import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { MonoText } from "./text";

/**
 * S3 OTP input: 6 mono cells. One hidden TextInput holds the value —
 * paste/auto-fill (`textContentType=oneTimeCode`, `autoComplete=sms-otp`)
 * lands the whole code at once; the cells are the display layer.
 */
export function OtpInput({
  onComplete,
  disabled = false,
}: {
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setValue(digits);
    if (digits.length === 6) onComplete(digits);
  };

  return (
    <Pressable accessibilityLabel="One-time code" onPress={() => inputRef.current?.focus()}>
      <View className="flex-row justify-between gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <View
            key={i}
            className={`h-14 flex-1 items-center justify-center rounded-md border bg-surface-card ${
              i === value.length && !disabled ? "border-surface-brand" : "border-border-strong"
            }`}
          >
            <MonoText className="text-h2">{value[i] ?? ""}</MonoText>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
        // Hidden capture layer — the cells above are the visible UI.
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        testID="otp-hidden-input"
      />
    </Pressable>
  );
}
